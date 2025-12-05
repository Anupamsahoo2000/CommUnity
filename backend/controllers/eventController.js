// backend/controllers/eventController.js
// Slightly hardened + path fixes + lat/lng coercion + clearer logs
const axios = require("axios");
const { Event, TicketType, Club } = require("../models/sql/index");
const { listEvents } = require("../services/eventServices"); // ensure this filename/path exists
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
      location, // free-text location/address (we now store this)
      lat: latBody,
      lng: lngBody,
      startTime,
      endTime,
      maxSeats,
      isFree,
      basePrice,
      clubId,
      status: requestedStatus, // allow client to optionally set status (DRAFT / PUBLISHED)
    } = req.body;

    if (!title || !startTime) {
      return res
        .status(400)
        .json({ message: "Title and startTime are required" });
    }

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ message: "Unauthorized: login required to create event" });
    }

    if (clubId) {
      const club = await Club.findByPk(clubId);
      if (!club)
        return res
          .status(400)
          .json({ message: "Provided clubId does not exist" });
    }

    // parse lat/lng as numbers if provided
    let lat = parseLatLng(latBody);
    let lng = parseLatLng(lngBody);

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

    // Default status (keep existing behavior) — change to "DRAFT" if you prefer default drafts.
    const finalStatus = requestedStatus || "PUBLISHED";
    if (String(finalStatus).toUpperCase() === "PUBLISHED") {
      if (lat === null || lng === null) {
        return res.status(400).json({
          message:
            "Geocoding required for published events. Provide lat & lng or a resolvable location/city.",
        });
      }
    }

    const organizerId = req.user.id;
    const slugBase = title + (city ? ` ${city}` : "");
    const slug = slugify(slugBase) + "-" + Date.now().toString(36).slice(-6);

    const ev = await Event.create({
      title,
      slug,
      description: description || null,
      category: category || null,
      city: city || null,
      location: location ? String(location).trim() : null,
      lat: lat ?? null,
      lng: lng ?? null,
      startTime,
      endTime: endTime || null,
      maxSeats: maxSeats ?? null,
      isFree: isFree === undefined ? true : !!isFree,
      basePrice: basePrice ?? 0,
      status: finalStatus,
      bannerUrl: req.body.bannerUrl || null,
      clubId: clubId || null,
      organizerId,
    });

    return res.status(201).json({ event: ev });
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

module.exports = {
  getEvents,
  createEvent,
  updateEvent,
};
