// backend/src/controllers/clubController.js
const sequelize = require("../config/db");
const {
  Club,
  ClubMember,
  Event,
  User,
  TicketType,
} = require("../models/sql/index");
const { Op, QueryTypes } = require("sequelize");
const {
  saveClubMessage,
  listClubMessages,
} = require("../services/chatService");
const { getIo } = require("../config/socket");
const path = require("path");
const { uploadPublicFile } = require("../utils/s3");

// Simple slugify helper (same style as events)
function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/\-+/g, "-")
    .replace(/^\-+|\-+$/g, "");
}

async function isOwnerOrAdmin(requester, club) {
  if (!requester) return false;
  if (requester.role === "ADMIN") return true;
  if (!club) return false;
  return String(club.ownerId) === String(requester.id);
}

/**
 * POST /api/clubs
 * Body: { name, description, category, city, location, lat, lng, isPaidMembership, membershipFee, bannerUrl }
 * Auth: any authenticated user (becomes owner)
 */
const createClub = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      name,
      description,
      category,
      city,
      lat,
      lng,
      isPaidMembership,
      membershipFee,
      bannerUrl,
      slug: providedSlug,
    } = req.body;

    if (!name) {
      await t.rollback();
      return res.status(400).json({ message: "name is required" });
    }

    const ownerId = req.user?.id;
    if (!ownerId) {
      await t.rollback();
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ensure unique slug
    let slug = providedSlug
      ? slugify(providedSlug)
      : slugify(`${name}-${city || ""}`);
    // if slug exists, append short suffix (safe)
    const existing = await Club.findOne({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36).slice(-6)}`;
    }

    const club = await Club.create(
      {
        name,
        slug,
        description: description || null,
        ownerId,
        category: category || null,
        city: city || null,
        lat: lat ?? null,
        lng: lng ?? null,
        isPaidMembership: !!isPaidMembership,
        membershipFee: membershipFee ?? null,
        bannerUrl: bannerUrl || null,
      },
      { transaction: t }
    );

    // Create ClubMember entry as OWNER
    await ClubMember.create(
      {
        clubId: club.id,
        userId: ownerId,
        role: "OWNER",
        status: "ACTIVE",
      },
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({ club });
  } catch (err) {
    await t.rollback();
    console.error("createClub error:", err);
    return res.status(500).json({ message: "Failed to create club" });
  }
};

/**
 * GET /api/clubs
 * Query: q, city, category, lat, lng, radiusKm, page, limit
 * Public
 */
const listClubs = async (req, res) => {
  try {
    const {
      q,
      city,
      category,
      lat,
      lng,
      radiusKm,
      page = 1,
      limit = 12,
    } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const perPage = Math.max(1, Math.min(100, Number(limit) || 12));
    const offset = (pageNum - 1) * perPage;

    // If lat/lng & radius provided use Haversine raw SQL
    if (lat && lng && radiusKm) {
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const radiusMeters = Number(radiusKm) * 1000;

      const distanceExpr = `(
        6371000 * acos(
          least(1, cos(radians(:lat)) * cos(radians("lat")) * cos(radians("lng") - radians(:lng)) + sin(radians(:lat)) * sin(radians("lat")))
        )
      )`;

      const extras = [];
      const repl = {
        lat: latNum,
        lng: lngNum,
        radius: radiusMeters,
        limit: perPage,
        offset,
      };
      if (q) {
        extras.push(`(name ILIKE :q OR description ILIKE :q)`);
        repl.q = `%${q}%`;
      }
      if (city) {
        extras.push(`city = :city`);
        repl.city = city;
      }
      if (category) {
        extras.push(`category = :category`);
        repl.category = category;
      }
      const whereSql = extras.length ? `AND ${extras.join(" AND ")}` : "";

      const countSql = `
        SELECT COUNT(*)::int AS total FROM "Clubs" c
        WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
        AND ${distanceExpr} <= :radius
        ${whereSql}
      `;
      const totalRes = await sequelize
        .query(countSql, { type: QueryTypes.SELECT, replacements: repl })
        .catch(() => [{ total: 0 }]);
      const total = totalRes?.[0]?.total ?? 0;

      const selectSql = `
        SELECT c.*, ${distanceExpr} AS distance_m
        FROM "Clubs" c
        WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
        AND ${distanceExpr} <= :radius
        ${whereSql}
        ORDER BY distance_m ASC
        LIMIT :limit OFFSET :offset
      `;
      const rows = await sequelize.query(selectSql, {
        type: QueryTypes.SELECT,
        replacements: repl,
      });
      return res.json({
        data: rows,
        meta: { total, page: pageNum, limit: perPage },
      });
    }

    // No geo filter: build Sequelize where
    const where = {};
    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } },
      ];
    }
    if (city) where.city = city;
    if (category) where.category = category;

    const { count, rows } = await Club.findAndCountAll({
      where,
      limit: perPage,
      offset,
      order: [["name", "ASC"]],
      attributes: [
        "id",
        "name",
        "slug",
        "description",
        "city",
        "category",
        "bannerUrl",
        "lat",
        "lng",
        "ownerId",
      ],
    });

    return res.json({
      data: rows,
      meta: { total: count, page: pageNum, limit: perPage },
    });
  } catch (err) {
    console.error("listClubs error:", err);
    return res.status(500).json({ message: "Failed to list clubs" });
  }
};

/**
 * GET /api/clubs/:id
 * Returns club details + its events (published)
 * Also enriches with memberCount, upcomingCount, isMember, canManage, members (sample)
 */
const getClub = async (req, res) => {
  try {
    const id = req.params.id;
    const requester = req.user;

    // Accept both uuid and slug
    const club = await Club.findOne({
      where: {
        [Op.or]: [{ id }, { slug: id }],
      },
      // do not eagerly load everything here; we'll load events and members separately for control
    });

    if (!club) return res.status(404).json({ message: "Club not found" });

    // Fetch published upcoming events (limit)
    const upcomingEvents = await Event.findAll({
      where: {
        clubId: club.id,
        status: "PUBLISHED",
        startTime: { [Op.gte]: new Date() },
      },
      order: [["startTime", "ASC"]],
      limit: 20,
      attributes: ["id", "title", "startTime", "bannerUrl", "slug", "city"],
    });

    // Member counts
    const memberCountRes = await ClubMember.count({
      where: { clubId: club.id, status: "ACTIVE" },
    });
    const pendingCountRes = await ClubMember.count({
      where: { clubId: club.id, status: "PENDING" },
    });

    // optionally include a small members list for public view (limited)
    const members = await ClubMember.findAll({
      where: { clubId: club.id, status: "ACTIVE" },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "city"],
        },
      ],
      order: [["createdAt", "ASC"]],
      limit: 30,
    });

    // check membership for requester
    let isMember = false;
    if (requester) {
      const m = await ClubMember.findOne({
        where: { clubId: club.id, userId: requester.id, status: "ACTIVE" },
      });
      isMember = !!m;
    }

    const canManage = await isOwnerOrAdmin(requester, club);

    // Build response shape expected by frontend
    const payload = {
      id: club.id,
      name: club.name,
      slug: club.slug,
      description: club.description,
      about: club.description, // keep both names for frontend convenience
      category: club.category,
      city: club.city,
      bannerUrl: club.bannerUrl,
      logoUrl: club.logoUrl || null,
      memberCount: Number(memberCountRes || 0),
      pendingCount: Number(pendingCountRes || 0),
      upcomingCount: upcomingEvents.length,
      upcomingEvents: upcomingEvents.map((e) => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime,
        bannerUrl: e.bannerUrl,
        slug: e.slug,
        city: e.city,
      })),
      members: (members || []).map((m) => ({
        id: m.user?.id || m.userId,
        name: m.user?.name || null,
        email: m.user?.email || null,
        role: m.role,
      })),
      isMember,
      canManage,
      visibility: club.visibility || "Public",
      createdAt: club.createdAt,
    };

    return res.json({ club: payload });
  } catch (err) {
    console.error("getClub error:", err);
    return res.status(500).json({ message: "Failed to load club" });
  }
};

/**
 * Update club - only owner or ADMIN
 * PUT /api/clubs/:id
 */
const updateClub = async (req, res) => {
  try {
    const id = req.params.id;
    const club = await Club.findByPk(id);
    if (!club) return res.status(404).json({ message: "Club not found" });

    const requester = req.user;
    if (!requester) return res.status(401).json({ message: "Unauthorized" });

    const allowed = await isOwnerOrAdmin(requester, club);
    if (!allowed)
      return res
        .status(403)
        .json({ message: "Forbidden: only club owner or admin may update" });

    const {
      name,
      description,
      category,
      city,
      lat,
      lng,
      isPaidMembership,
      membershipFee,
      bannerUrl,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (city !== undefined) updates.city = city;
    if (lat !== undefined) updates.lat = lat;
    if (lng !== undefined) updates.lng = lng;
    if (isPaidMembership !== undefined)
      updates.isPaidMembership = !!isPaidMembership;
    if (membershipFee !== undefined) updates.membershipFee = membershipFee;
    if (bannerUrl !== undefined) updates.bannerUrl = bannerUrl;

    await club.update(updates);
    return res.json({ club });
  } catch (err) {
    console.error("updateClub error:", err);
    return res.status(500).json({ message: "Failed to update club" });
  }
};

/**
 * POST /api/clubs/:id/join
 * Body: { userId? } — if userId present and requester is ADMIN, you can add other users.
 * Behavior: create ClubMember with PENDING by default, or ACTIVE if autoApprove query param true
 */
const joinClub = async (req, res) => {
  try {
    const clubId = req.params.id;
    const club = await Club.findByPk(clubId);
    if (!club) return res.status(404).json({ message: "Club not found" });

    const requester = req.user;
    if (!requester) return res.status(401).json({ message: "Unauthorized" });

    // If admin is adding someone else
    const targetUserId =
      req.body.userId && requester.role === "ADMIN"
        ? req.body.userId
        : requester.id;

    const existing = await ClubMember.findOne({
      where: { clubId, userId: targetUserId },
    });
    if (existing) {
      return res.status(409).json({ message: "Already a member or pending" });
    }

    const autoApprove =
      req.query.autoApprove === "true" || req.body.autoApprove === true;
    const status = autoApprove ? "ACTIVE" : "PENDING";

    const membership = await ClubMember.create({
      clubId,
      userId: targetUserId,
      role: "MEMBER",
      status,
    });

    return res.status(201).json({ membership });
  } catch (err) {
    console.error("joinClub error:", err);
    return res.status(500).json({ message: "Failed to join club" });
  }
};

/**
 * POST /api/clubs/:id/leave
 * Auth required: current user leaves the club (deletes ClubMember row)
 */
const leaveClub = async (req, res) => {
  try {
    const clubId = req.params.id;
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: "Unauthorized" });

    const membership = await ClubMember.findOne({
      where: { clubId, userId: requester.id },
    });

    if (!membership) {
      return res.status(404).json({ message: "Membership not found" });
    }

    // Prevent owner from leaving without transfer (owner must delete or transfer)
    if (membership.role === "OWNER") {
      return res.status(400).json({
        message:
          "Owner cannot leave the club. Transfer ownership or delete the club.",
      });
    }

    await ClubMember.destroy({ where: { id: membership.id } });
    return res.json({ message: "Left club successfully" });
  } catch (err) {
    console.error("leaveClub error:", err);
    return res.status(500).json({ message: "Failed to leave club" });
  }
};

/**
 * GET /api/clubs/:id/members
 * Query: status (ACTIVE|PENDING|REJECTED), role (OWNER|MODERATOR|MEMBER)
 * Only club owner / ADMIN or requester who is a member can view (privacy).
 */
const getClubMembers = async (req, res) => {
  try {
    const clubId = req.params.id;
    const club = await Club.findByPk(clubId);
    if (!club) return res.status(404).json({ message: "Club not found" });

    const requester = req.user;
    if (!requester) return res.status(401).json({ message: "Unauthorized" });

    const isAdmin = requester.role === "ADMIN";
    const isOwner = String(club.ownerId) === String(requester.id);
    const isMember = await ClubMember.findOne({
      where: { clubId, userId: requester.id, status: "ACTIVE" },
    });

    if (!isAdmin && !isOwner && !isMember) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const where = { clubId };
    const { status, role } = req.query;
    if (status) where.status = status;
    if (role) where.role = role;

    const members = await ClubMember.findAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "city"],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    return res.json({ members });
  } catch (err) {
    console.error("getClubMembers error:", err);
    return res.status(500).json({ message: "Failed to get members" });
  }
};

const deleteClub = async (req, res) => {
  const clubId = req.params.id;
  const force = req.query.force === "true";

  const t = await sequelize.transaction();
  try {
    const club = await Club.findByPk(clubId, { transaction: t });
    if (!club) {
      await t.rollback();
      return res.status(404).json({ message: "Club not found" });
    }

    const requester = req.user;
    if (!requester) {
      await t.rollback();
      return res.status(401).json({ message: "Unauthorized" });
    }

    const allowed = await isOwnerOrAdmin(requester, club);
    if (!allowed) {
      await t.rollback();
      return res.status(403).json({
        message: "Forbidden: only club owner or admin may delete the club",
      });
    }

    if (force) {
      // Cascade: delete ticket types -> delete events -> delete memberships -> delete club
      const events = await Event.findAll({ where: { clubId }, transaction: t });
      const eventIds = events.map((e) => e.id);

      if (eventIds.length) {
        await TicketType.destroy({
          where: { eventId: eventIds },
          transaction: t,
        });
        // If you have Bookings/Payments/Chats models, delete them here as needed
        await Event.destroy({ where: { id: eventIds }, transaction: t });
      }

      await ClubMember.destroy({ where: { clubId }, transaction: t });
      await Club.destroy({ where: { id: clubId }, transaction: t });

      await t.commit();
      return res.json({
        message:
          "Club and its events + ticket types were deleted (force=true).",
      });
    } else {
      // Non-forced: detach events, delete memberships, delete club
      await Event.update(
        { clubId: null },
        { where: { clubId }, transaction: t }
      );
      await ClubMember.destroy({ where: { clubId }, transaction: t });
      await Club.destroy({ where: { id: clubId }, transaction: t });

      await t.commit();
      return res.json({
        message:
          "Club deleted. Associated events were detached (clubId set to null).",
      });
    }
  } catch (err) {
    await t.rollback();
    console.error("deleteClub error:", err);
    return res.status(500).json({ message: "Failed to delete club" });
  }
};
/**
 * GET /clubs/:id/chat
 * Public: returns recent club chat messages
 */
const getClubChat = async (req, res) => {
  try {
    const clubId = req.params.id;
    if (!clubId) {
      return res.status(400).json({ message: "clubId is required" });
    }

    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const messages = await listClubMessages(clubId, limit);

    const data = messages.map((m) => ({
      id: m._id,
      clubId: m.clubId,
      senderId: m.senderId,
      senderName: m.senderName,
      text: m.text,
      isAdminOrOwner: m.isAdminOrOwner,
      createdAt: m.createdAt,
    }));

    return res.json({ data });
  } catch (err) {
    console.error("getClubChat error:", err);
    return res.status(500).json({ message: "Failed to load club chat" });
  }
};

/**
 * POST /clubs/:id/chat
 * Auth required
 * Body: { text }
 */
const postClubChat = async (req, res) => {
  try {
    const clubId = req.params.id;
    const user = req.user;
    const { text } = req.body || {};

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!clubId) {
      return res.status(400).json({ message: "clubId is required" });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "text is required" });
    }

    const isAdminOrOwner = user.role === "ADMIN" || user.role === "HOST";

    const msg = await saveClubMessage({
      clubId,
      senderId: user.id,
      senderName: user.name || user.email || "User",
      text: text.trim(),
      isAdminOrOwner,
    });

    const dto = {
      id: msg._id,
      clubId: msg.clubId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      text: msg.text,
      isAdminOrOwner: msg.isAdminOrOwner,
      createdAt: msg.createdAt,
    };

    // broadcast to club room
    try {
      const io = getIo();
      io.to(`club:${clubId}`).emit("chat_message", dto);
    } catch (sockErr) {
      console.error("club chat_message emit failed:", sockErr);
    }

    return res.status(201).json({ message: dto });
  } catch (err) {
    console.error("postClubChat error:", err);
    return res.status(500).json({ message: "Failed to send club message" });
  }
};

/**
 * POST /clubs/:id/banner
 * Auth: OWNER/ADMIN/HOST (simplified: HOST/ADMIN)
 * Form: multipart/form-data with field "banner"
 */
const uploadClubBanner = async (req, res) => {
  try {
    const clubId = req.params.id;
    const user = req.user;
    const file = req.file;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!file) {
      return res.status(400).json({ message: "banner file is required" });
    }

    const club = await Club.findByPk(clubId);
    if (!club) {
      return res.status(404).json({ message: "Club not found" });
    }

    // TODO: refine to check ownerId / club membership role
    if (user.role !== "HOST" && user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ message: "Only hosts or admins can upload banners" });
    }

    const ext = path.extname(file.originalname) || ".jpg";
    const key = `clubs/${clubId}/banner${ext}`;

    const bannerUrl = await uploadPublicFile(file.buffer, key, file.mimetype);

    club.bannerUrl = bannerUrl;
    await club.save();

    return res.json({ bannerUrl });
  } catch (err) {
    console.error("uploadClubBanner error:", err);
    return res.status(500).json({ message: "Failed to upload club banner" });
  }
};

module.exports = {
  createClub,
  listClubs,
  getClub,
  updateClub,
  joinClub,
  leaveClub,
  getClubMembers,
  deleteClub,
  getClubChat,
  postClubChat,
  uploadClubBanner,
};
