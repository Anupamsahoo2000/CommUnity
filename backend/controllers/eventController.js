// backend/controllers/eventController.js
// Slightly hardened + path fixes + lat/lng coercion + clearer logs
const axios = require("axios");
const { Event, TicketType, Club } = require("../models/sql/index");
const { listEvents } = require("../services/eventServices"); // ensure this filename/path exists
const {
  getEventTicketsWithAvailability,
  getEventSeatsSummary,
} = require("../services/seatsService");

const {
  listEventMessages,
  saveEventMessage,
} = require("../services/chatService");
const { getIo } = require("../config/socket");
const path = require("path");
const { uploadPublicFile } = require("../utils/s3");

// If your service file is named differently, update the path above.

const geocodeCache = new Map();

function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/\-+/g, "-")
    .replace(/^\-+|\-+$/g, "");
}

/**
 * Geocode a free-text location using configured provider(s).
 * Returns: { lat: Number, lng: Number, displayName: String } or null
 */
async function geocodeLocation(location) {
  if (!location || !String(location).trim()) return null;

  const key = String(location).trim().toLowerCase();
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key);
  }

  const provider = (
    process.env.GEOCODING_PROVIDER || "nominatim"
  ).toLowerCase();

  try {
    if (provider === "google" && process.env.GEOCODING_API_KEY) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json`;
      const resp = await axios.get(url, {
        params: { address: location, key: process.env.GEOCODING_API_KEY },
        timeout: Number(process.env.GEOCODING_TIMEOUT_MS || 8000),
      });
      if (resp?.data?.results?.length) {
        const r = resp.data.results[0];
        const lat = Number(r.geometry?.location?.lat);
        const lng = Number(r.geometry?.location?.lng);
        const record = {
          lat,
          lng,
          displayName: r.formatted_address,
          provider: "google",
        };
        geocodeCache.set(key, record);
        return record;
      }
    }
  } catch (err) {
    console.warn("Google geocoding failed:", err?.message || err);
    // continue to fallback
  }

  // Nominatim fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search`;
    const resp = await axios.get(nomUrl, {
      params: {
        q: location,
        format: "json",
        addressdetails: 0,
        limit: 1,
      },
      headers: {
        "User-Agent":
          process.env.NOMINATIM_USER_AGENT ||
          "CommUnity/1.0 (anupamsahoo2712@gmail.com)",
      },
      timeout: Number(process.env.GEOCODING_TIMEOUT_MS || 8000),
    });

    if (Array.isArray(resp.data) && resp.data.length > 0) {
      const r = resp.data[0];
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      const record = {
        lat,
        lng,
        displayName: r.display_name,
        provider: "nominatim",
      };
      geocodeCache.set(key, record);
      return record;
    }
  } catch (err) {
    console.warn("Nominatim geocoding failed:", err?.message || err);
  }

  // Local fallback map
  const cityMap = {
    bhubaneswar: { lat: 20.2961, lng: 85.8245 },
    bangalore: { lat: 12.9716, lng: 77.5946 },
    bengaluru: { lat: 12.9716, lng: 77.5946 },
    hyderabad: { lat: 17.385, lng: 78.4867 },
    mumbai: { lat: 19.076, lng: 72.8777 },
    delhi: { lat: 28.7041, lng: 77.1025 },
  };

  for (const k of Object.keys(cityMap)) {
    if (key.includes(k)) {
      const record = {
        ...cityMap[k],
        displayName: `${k}, India`,
        provider: "local",
      };
      geocodeCache.set(key, record);
      return record;
    }
  }

  geocodeCache.set(key, null);
  return null;
}

// Helper: parse lat/lng values reliably
function parseLatLng(val) {
  if (val === undefined || val === null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

// CREATE Event
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      city,
      location,
      lat: latBody,
      lng: lngBody,
      startTime,
      endTime,
      maxSeats,
      clubId,
      status: requestedStatus,
      ticketTypes = [], // 👈 IMPORTANT
    } = req.body;

    if (!title || !startTime) {
      return res
        .status(400)
        .json({ message: "Title and startTime are required" });
    }

    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // -------------------------------
    // GEO LOGIC (unchanged)
    // -------------------------------
    let lat = parseLatLng(latBody);
    let lng = parseLatLng(lngBody);

    if ((lat == null || lng == null) && location) {
      const geo = await geocodeLocation(location);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }

    if ((lat == null || lng == null) && city) {
      const geo = await geocodeLocation(city);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }

    const status = requestedStatus || "PUBLISHED";
    if (status === "PUBLISHED" && (lat == null || lng == null)) {
      return res.status(400).json({
        message: "lat/lng required for published events",
      });
    }

    // -------------------------------
    // 🔑 PRICING LOGIC (FIX)
    // -------------------------------
    const normalizedTickets = Array.isArray(ticketTypes)
      ? ticketTypes.map((t) => ({
          name: t.name,
          price: Number(t.price || 0),
          quota: Number(t.quota || 0),
        }))
      : [];

    const isFree =
      normalizedTickets.length === 0 ||
      normalizedTickets.every((t) => t.price === 0);

    const basePrice =
      normalizedTickets.length > 0
        ? Math.min(...normalizedTickets.map((t) => t.price))
        : 0;

    // -------------------------------
    // CREATE EVENT
    // -------------------------------
    const event = await Event.create({
      title,
      description,
      category,
      city,
      location,
      lat,
      lng,
      startTime,
      endTime: endTime || null,
      maxSeats,
      status,
      isFree, // ✅ derived
      basePrice, // ✅ derived
      organizerId: req.user.id,
      clubId: clubId || null,
    });

    // -------------------------------
    // CREATE TICKET TYPES 🔥
    // -------------------------------
    for (const t of normalizedTickets) {
      if (!t.name || t.quota <= 0) continue;

      await TicketType.create({
        eventId: event.id,
        name: t.name,
        price: t.price,
        quota: t.quota,
        isActive: true,
      });
    }

    return res.status(201).json({ event });
  } catch (err) {
    console.error("createEvent error:", err);
    return res.status(500).json({ message: "Failed to create event" });
  }
};

// UPDATE Event
const updateEvent = async (req, res) => {
  try {
    const id = req.params.id;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const requestingUser = req.user;
    if (!requestingUser)
      return res.status(401).json({ message: "Unauthorized" });

    const isOrganizer = String(event.organizerId) === String(requestingUser.id);
    const isAdmin = requestingUser.role === "ADMIN";

    if (!isOrganizer && !isAdmin) {
      if (event.clubId) {
        const club = await Club.findByPk(event.clubId);
        if (!(club && String(club.ownerId) === String(requestingUser.id))) {
          return res
            .status(403)
            .json({ message: "Forbidden: not the organizer or club owner" });
        }
      } else {
        return res
          .status(403)
          .json({ message: "Forbidden: not the organizer" });
      }
    }

    const {
      title,
      description,
      category,
      city,
      location, // new free-text location to save
      lat: latBody,
      lng: lngBody,
      startTime,
      endTime,
      maxSeats,
      isFree,
      basePrice,
      bannerUrl,
      status,
    } = req.body;

    // parse lat/lng with priority and fallback
    let lat = latBody !== undefined ? parseLatLng(latBody) : event.lat ?? null;
    let lng = lngBody !== undefined ? parseLatLng(lngBody) : event.lng ?? null;

    if ((lat === null || lng === null) && location) {
      const geo = await geocodeLocation(location);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }

    if ((lat === null || lng === null) && city) {
      const geo = await geocodeLocation(city);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }

    const newStatus = status !== undefined ? status : event.status;
    if (String(newStatus).toUpperCase() === "PUBLISHED") {
      if (lat === null || lng === null) {
        return res.status(400).json({
          message:
            "Geocoding required for published events. Provide lat & lng or a resolvable location/city.",
        });
      }
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (city !== undefined) updates.city = city;
    if (location !== undefined)
      updates.location = location ? String(location).trim() : null;
    updates.lat = lat ?? null;
    updates.lng = lng ?? null;
    if (startTime !== undefined) updates.startTime = startTime;
    if (endTime !== undefined) updates.endTime = endTime;
    if (maxSeats !== undefined) updates.maxSeats = maxSeats;
    if (isFree !== undefined) updates.isFree = !!isFree;
    if (basePrice !== undefined) updates.basePrice = basePrice;
    if (bannerUrl !== undefined) updates.bannerUrl = bannerUrl;
    if (status !== undefined) updates.status = status;

    await event.update(updates);

    return res.json({ event });
  } catch (err) {
    console.error("updateEvent error:", err);
    return res.status(500).json({ message: "Failed to update event" });
  }
};

const getEvents = async (req, res) => {
  try {
    const {
      q,
      city,
      category,
      date_from,
      date_to,
      price,
      lat,
      lng,
      radiusKm,
      page,
      limit,
      sort,
    } = req.query;

    const result = await listEvents({
      q,
      city,
      category,
      date_from,
      date_to,
      price,
      lat,
      lng,
      radiusKm,
      page,
      limit,
      sort,
    });

    res.json({
      data: result.data,
      meta: result.meta,
    });
  } catch (err) {
    console.error("GET /api/events error:", err);
    res.status(500).json({ message: "Failed to list events" });
  }
};

// GET /events/:id  (public - single event with tickets + club info)
const getEventById = async (req, res) => {
  try {
    const id = req.params.id;

    const event = await Event.findByPk(id, {
      include: [
        {
          model: TicketType,
          as: "ticketTypes",
          attributes: ["id", "name", "price", "quota"], // adjust if more fields
        },
        {
          model: Club,
          as: "club",
          attributes: ["id", "name", "slug", "city"],
        },
      ],
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Optionally calculate a simple seatsLeft from maxSeats
    // (your event.js already falls back to maxSeats if seatsLeft is missing)
    const data = event.toJSON();
    if (data.seatsLeft === undefined && data.maxSeats != null) {
      data.seatsLeft = data.maxSeats;
    }

    return res.json({ event: data });
  } catch (err) {
    console.error("getEventById error:", err);
    return res.status(500).json({ message: "Failed to load event" });
  }
};

// GET /events/:id/tickets
// Public: returns all ticket types for this event
const getEventTickets = async (req, res) => {
  try {
    const eventId = req.params.id;

    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const tickets = await TicketType.findAll({
      where: {
        eventId,
        isActive: true, // 🔥 IMPORTANT (matches booking logic)
      },
      order: [["price", "ASC"]],
      attributes: ["id", "name", "price", "quota"],
    });

    // ✅ MUST return `tickets`, not `data`
    return res.json({ tickets });
  } catch (err) {
    console.error("getEventTickets error:", err);
    return res.status(500).json({ message: "Failed to load ticket types" });
  }
};

// POST /events/:id/tickets
// Auth: HOST / ADMIN (route will enforce)
const createTicketType = async (req, res) => {
  try {
    const eventId = req.params.id;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const { name, description, price, quota, salesStart, salesEnd } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Ticket name is required" });
    }
    if (quota == null || Number(quota) <= 0) {
      return res
        .status(400)
        .json({ message: "quota (seats) must be a positive number" });
    }

    const ticket = await TicketType.create({
      eventId: event.id,
      name,
      description: description || null,
      price: Number(price || 0),
      quota: Number(quota),
      salesStart: salesStart || null,
      salesEnd: salesEnd || null,
      isActive: true,
    });

    return res.status(201).json({ ticket });
  } catch (err) {
    console.error("createTicketType error:", err);
    return res.status(500).json({ message: "Failed to create ticket type" });
  }
};

// GET /api/events/:id/seats
// Lightweight seats summary for live counters / polling
const getEventSeats = async (req, res) => {
  try {
    const eventId = req.params.id;

    const event = await Event.findByPk(eventId, {
      attributes: ["id", "title", "status"],
    });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const summary = await getEventSeatsSummary(eventId);

    return res.json({
      eventId: event.id,
      eventTitle: event.title,
      ...summary,
    });
  } catch (err) {
    console.error("getEventSeats error:", err);
    return res.status(500).json({ message: "Failed to load seats summary" });
  }
};

/**
 * GET /events/:id/chat
 * Public: returns recent chat messages for this event
 */
const getEventChat = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ message: "eventId is required" });
    }

    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const messages = await listEventMessages(eventId, limit);

    // Shape it nicely for frontend
    const data = messages.map((m) => ({
      id: m._id,
      eventId: m.eventId,
      senderId: m.senderId,
      senderName: m.senderName,
      text: m.text,
      isOrganizer: m.isOrganizer,
      createdAt: m.createdAt,
    }));

    return res.json({ data });
  } catch (err) {
    console.error("getEventChat error:", err);
    return res.status(500).json({ message: "Failed to load chat messages" });
  }
};

/**
 * POST /events/:id/chat
 * Auth required
 * Body: { text }
 */
const postEventChat = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const user = req.user;
    const { text } = req.body || {};

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!eventId) {
      return res.status(400).json({ message: "eventId is required" });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "text is required" });
    }

    const isOrganizer = user.role === "HOST" || user.role === "ADMIN"; // simple rule; can be made richer

    const msg = await saveEventMessage({
      eventId,
      senderId: user.id,
      senderName: user.name || user.email || "User",
      text: text.trim(),
      isOrganizer,
    });

    const dto = {
      id: msg._id,
      eventId: msg.eventId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      text: msg.text,
      isOrganizer: msg.isOrganizer,
      createdAt: msg.createdAt,
    };

    // 🔴 Broadcast in realtime to everyone in this event room
    try {
      const io = getIo();
      io.to(`event:${eventId}`).emit("chat_message", dto);
    } catch (sockErr) {
      console.error("chat_message emit failed:", sockErr);
    }

    return res.status(201).json({ message: dto });
  } catch (err) {
    console.error("postEventChat error:", err);
    return res.status(500).json({ message: "Failed to send chat message" });
  }
};

/**
 * POST /events/:id/banner
 * Auth: HOST/ADMIN, must own the event (simplified: any HOST/ADMIN for now)
 * Form: multipart/form-data with field "banner"
 */
const uploadEventBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!file) {
      return res.status(400).json({ message: "banner file is required" });
    }

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // TODO: stricter check: only organizer or club owner
    if (user.role !== "HOST" && user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ message: "Only hosts or admins can upload banners" });
    }

    const ext = path.extname(file.originalname) || ".jpg";
    const key = `events/${id}/banner${ext}`;

    const bannerUrl = await uploadPublicFile(file.buffer, key, file.mimetype);

    event.bannerUrl = bannerUrl;
    await event.save();

    return res.json({ bannerUrl });
  } catch (err) {
    console.error("uploadEventBanner error:", err);
    return res.status(500).json({ message: "Failed to upload banner" });
  }
};

// CANCEL EVENT
// POST /events/:id/cancel
const cancelEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Already cancelled
    if (event.status === "CANCELLED") {
      return res.status(400).json({ message: "Event already cancelled" });
    }

    // Permission checks
    const isAdmin = user.role === "ADMIN";
    const isOrganizer = String(event.organizerId) === String(user.id);

    let isClubOwner = false;
    if (event.clubId) {
      const club = await Club.findByPk(event.clubId);
      if (club && String(club.ownerId) === String(user.id)) {
        isClubOwner = true;
      }
    }

    if (!isAdmin && !isOrganizer && !isClubOwner) {
      return res.status(403).json({
        message: "Forbidden: not allowed to cancel this event",
      });
    }

    // Prevent cancelling completed events
    const now = new Date();
    if (event.startTime && new Date(event.startTime) < now) {
      return res.status(400).json({
        message: "Event has already started or completed",
      });
    }

    // Cancel event
    event.status = "CANCELLED";
    await event.save();

    /**
     * 🔜 Future enhancements:
     * - Refund CONFIRMED bookings
     * - Release seats via seatsService
     * - Notify users (email / socket)
     */

    return res.json({
      message: "Event cancelled successfully",
      eventId: event.id,
      status: event.status,
    });
  } catch (err) {
    console.error("cancelEvent error:", err);
    return res.status(500).json({ message: "Failed to cancel event" });
  }
};

// DELETE EVENT (Only CANCELLED / COMPLETED/DRAFT events)
const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // ❗ Status guard
    if (!["CANCELLED", "COMPLETED", "DRAFT"].includes(event.status)) {
      return res.status(400).json({
        message: "Only cancelled, completed, or draft events can be deleted",
      });
    }

    // Permission checks
    const isAdmin = user.role === "ADMIN";
    const isOrganizer = String(event.organizerId) === String(user.id);

    let isClubOwner = false;
    if (event.clubId) {
      const club = await Club.findByPk(event.clubId);
      if (club && String(club.ownerId) === String(user.id)) {
        isClubOwner = true;
      }
    }

    if (!isAdmin && !isOrganizer && !isClubOwner) {
      return res.status(403).json({
        message: "Forbidden: not allowed to delete this event",
      });
    }

    /**
     * 🔴 Important:
     * We DO NOT cascade delete bookings/payments here.
     * Those stay for audit & finance history.
     */

    await event.destroy();

    return res.json({
      message: "Event deleted successfully",
      eventId,
    });
  } catch (err) {
    console.error("deleteEvent error:", err);
    return res.status(500).json({ message: "Failed to delete event" });
  }
};

module.exports = {
  getEvents,
  createEvent,
  updateEvent,
  getEventTickets,
  getEventSeats,
  getEventById,
  createTicketType,
  getEventChat,
  postEventChat,
  uploadEventBanner,
  cancelEvent,
  deleteEvent,
};
