// backend/src/controllers/club.controller.js
const { Op, QueryTypes } = require("sequelize");
const {
  Club,
  ClubMember,
  Event,
  User,
  TicketType,
} = require("../models/sql/index");

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
    // if slug exists, append short suffix
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

    // If lat/lng & radius provided use Haversine raw SQL (similar to events service)
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
 */
const getClub = async (req, res) => {
  try {
    const id = req.params.id;
    // Accept both uuid and slug
    const club = await Club.findOne({
      where: {
        [Op.or]: [{ id }, { slug: id }],
      },
      include: [
        {
          model: Event,
          as: "events",
          where: { status: "PUBLISHED" },
          required: false,
          limit: 20,
          order: [["startTime", "ASC"]],
        },
      ],
    });

    if (!club) return res.status(404).json({ message: "Club not found" });
    return res.json({ club });
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
      return res
        .status(403)
        .json({
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

module.exports = {
  createClub,
  listClubs,
  getClub,
  updateClub,
  joinClub,
  getClubMembers,
  deleteClub,
};
