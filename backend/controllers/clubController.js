const sequelize = require("../config/db");
const { Club, ClubMember, Event, User, TicketType } = require("../models/sql");
const { Op, QueryTypes } = require("sequelize");
const {
  saveClubMessage,
  listClubMessages,
} = require("../services/chatService");
const { getIo } = require("../config/socket");
const path = require("path");
const { uploadPublicFile } = require("../utils/s3");

/* ===================== HELPERS ===================== */

function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/\-+/g, "-")
    .replace(/^\-+|\-+$/g, "");
}

async function isOwnerOrAdmin(user, clubId) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  const owner = await ClubMember.findOne({
    where: {
      clubId,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  return !!owner;
}

/* ===================== CREATE CLUB ===================== */

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

    let slug = providedSlug
      ? slugify(providedSlug)
      : slugify(`${name}-${city || ""}`);

    const exists = await Club.findOne({ where: { slug } });
    if (exists) {
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

/* ===================== LIST CLUBS ===================== */

const listClubs = async (req, res) => {
  try {
    const { q, city, category, page = 1, limit = 12 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const perPage = Math.max(1, Number(limit));
    const offset = (pageNum - 1) * perPage;

    const where = {};
    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } },
      ];
    }
    if (city) where.city = city;
    if (category) where.category = category;

    const { rows, count } = await Club.findAndCountAll({
      where,
      limit: perPage,
      offset,
      order: [["name", "ASC"]],
      attributes: [
        "id",
        "name",
        "slug",
        "category",
        "city",
        "bannerUrl",
        [
          sequelize.literal(`(
            SELECT COUNT(*)
            FROM "ClubMembers" cm
            WHERE cm."clubId" = "Club"."id"
            AND cm."status" = 'ACTIVE'
          )`),
          "memberCount",
        ],
      ],
    });

    return res.json({
      data: rows,
      meta: {
        total: count,
        page: pageNum,
        limit: perPage,
      },
    });
  } catch (err) {
    console.error("listClubs error:", err);
    return res.status(500).json({ message: "Failed to list clubs" });
  }
};

/* ===================== GET CLUB ===================== */

const getClub = async (req, res) => {
  try {
    const id = req.params.id;
    const requester = req.user || null;

    const club = await Club.findOne({
      where: { [Op.or]: [{ id }, { slug: id }] },
    });
    if (!club) return res.status(404).json({ message: "Club not found" });

    const upcomingEvents = await Event.findAll({
      where: {
        clubId: club.id,
        status: "PUBLISHED",
        startTime: { [Op.gte]: new Date() },
      },
      order: [["startTime", "ASC"]],
      limit: 20,
      attributes: ["id", "title", "startTime"],
    });

    const memberCount = await ClubMember.count({
      where: { clubId: club.id, status: "ACTIVE" },
    });

    let isMember = false;
    if (requester) {
      const m = await ClubMember.findOne({
        where: {
          clubId: club.id,
          userId: requester.id,
          status: "ACTIVE",
        },
      });
      isMember = !!m;
    }

    const canManage = await isOwnerOrAdmin(requester, club.id);

    return res.json({
      club: {
        id: club.id,
        name: club.name,
        slug: club.slug,
        description: club.description,
        about: club.description,
        category: club.category,
        city: club.city,
        bannerUrl: club.bannerUrl,
        memberCount,
        upcomingEvents,
        isMember,
        canManage,
      },
    });
  } catch (err) {
    console.error("getClub error:", err);
    return res.status(500).json({ message: "Failed to load club" });
  }
};

/* ===================== JOIN CLUB ===================== */

const joinClub = async (req, res) => {
  try {
    const clubId = req.params.id;
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const [membership] = await ClubMember.findOrCreate({
      where: { clubId, userId: user.id },
      defaults: {
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    return res.status(201).json({ membership });
  } catch (err) {
    console.error("joinClub error:", err);
    return res.status(500).json({ message: "Failed to join club" });
  }
};

/* ===================== LEAVE CLUB ===================== */

const leaveClub = async (req, res) => {
  try {
    const clubId = req.params.id;
    const user = req.user;

    const membership = await ClubMember.findOne({
      where: { clubId, userId: user.id },
    });

    if (!membership) {
      return res.status(404).json({ message: "Membership not found" });
    }

    if (membership.role === "OWNER") {
      return res.status(400).json({
        message: "Owner cannot leave the club",
      });
    }

    await membership.update({ status: "LEFT" });

    return res.json({ message: "Left club successfully" });
  } catch (err) {
    console.error("leaveClub error:", err);
    return res.status(500).json({ message: "Failed to leave club" });
  }
};

/* ===================== CLUB CHAT ===================== */

const getClubChat = async (req, res) => {
  try {
    const clubId = req.params.id;
    const messages = await listClubMessages(clubId, 100);

    return res.json({
      data: messages.map((m) => ({
        id: m._id,
        senderId: m.senderId,
        senderName: m.senderName,
        text: m.text,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error("getClubChat error:", err);
    return res.status(500).json({ message: "Failed to load chat" });
  }
};

const postClubChat = async (req, res) => {
  try {
    const clubId = req.params.id;
    const user = req.user;
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ message: "text is required" });
    }

    const isAdminOrOwner = await isOwnerOrAdmin(user, clubId);

    const msg = await saveClubMessage({
      clubId,
      senderId: user.id,
      senderName: user.name || user.email,
      text: text.trim(),
      isAdminOrOwner,
    });

    const dto = {
      id: msg._id,
      clubId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      text: msg.text,
      createdAt: msg.createdAt,
    };

    const io = getIo();
    io.to(`club:${clubId}`).emit("chat_message", dto);

    return res.status(201).json({ message: dto });
  } catch (err) {
    console.error("postClubChat error:", err);
    return res.status(500).json({ message: "Failed to send message" });
  }
};

/* ===================== EXPORT ===================== */

module.exports = {
  createClub,
  listClubs,
  getClub,
  joinClub,
  leaveClub,
  getClubChat,
  postClubChat,
};
