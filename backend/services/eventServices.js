// backend/src/services/event.service.js
const { sequelize, Event, Club, TicketType, User } = require("../models/sql/index");
const { Op, QueryTypes } = require("sequelize");

/**
 * Build a WHERE clause object for Sequelize based on filters.
 * Supports q, city, category, date_from, date_to, price (FREE|PAID|ANY), lat,lng,radiusKm
 */
async function listEvents({
  q,
  city,
  category,
  date_from,
  date_to,
  price,
  lat,
  lng,
  radiusKm,
  page = 1,
  limit = 12,
  sort = "startTime:asc",
}) {
  page = Number(page) || 1;
  limit = Number(limit) || 12;
  const offset = (page - 1) * limit;

  // Base where
  const where = {};

  if (q) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${q}%` } },
      { description: { [Op.iLike]: `%${q}%` } },
    ];
  }

  if (city) {
    where.city = city;
  }

  if (category) {
    where.category = category;
  }

  if (date_from) {
    where.startTime = where.startTime || {};
    where.startTime[Op.gte] = new Date(date_from);
  }
  if (date_to) {
    where.startTime = where.startTime || {};
    // include events that start before or equal to date_to (end of day)
    const dt = new Date(date_to);
    dt.setHours(23, 59, 59, 999);
    where.startTime[Op.lte] = dt;
  }

  if (price === "FREE") {
    where.isFree = true;
  } else if (price === "PAID") {
    where.isFree = false;
  }

  // Sorting
  let order = [["startTime", "ASC"]];
  if (sort) {
    const [field, dir] = String(sort).split(":");
    const direction = (dir || "asc").toUpperCase() === "DESC" ? "DESC" : "ASC";
    // Protect only allowed sort fields
    const allowed = new Set(["startTime", "createdAt", "title"]);
    if (allowed.has(field)) {
      order = [[field, direction]];
    }
  }

  // If lat/lng & radius provided, use Haversine raw query to compute distance and filter.
  // We'll fallback to normal where if lat/lng not provided.
  if (lat && lng && radiusKm) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const radiusMeters = Number(radiusKm) * 1000;

    // Haversine formula in meters - Postgres expects radians; we use earth radius 6371000 m
    // We'll run a raw count + raw select with distance computed and then apply pagination.
    const replacements = {
      lat: latNum,
      lng: lngNum,
      radius: radiusMeters,
      limit,
      offset,
    };

    // Build additional where clauses (city, category, q, dates, price) as SQL snippets
    const extras = [];
    const extraRepl = {};
    if (q) {
      extras.push("(e.title ILIKE :q OR e.description ILIKE :q)");
      extraRepl.q = `%${q}%`;
    }
    if (city) {
      extras.push("e.city = :city");
      extraRepl.city = city;
    }
    if (category) {
      extras.push("e.category = :category");
      extraRepl.category = category;
    }
    if (date_from) {
      extras.push("e.startTime >= :date_from");
      extraRepl.date_from = new Date(date_from).toISOString();
    }
    if (date_to) {
      const dt = new Date(date_to);
      dt.setHours(23, 59, 59, 999);
      extras.push("e.startTime <= :date_to");
      extraRepl.date_to = dt.toISOString();
    }
    if (price === "FREE") {
      extras.push("e.isFree = true");
    }
    if (price === "PAID") {
      extras.push("e.isFree = false");
    }

    const whereSql = extras.length ? `AND ${extras.join(" AND ")}` : "";

    // Distance expression (meters) using Haversine
    const distanceExpr = `(
      6371000 * acos(
        least(1, cos(radians(:lat)) * cos(radians(e.lat)) * cos(radians(e.lng) - radians(:lng)) + sin(radians(:lat)) * sin(radians(e.lat)))
      )
    )`;

    // Count total matching
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM "Events" e
      WHERE e.lat IS NOT NULL AND e.lng IS NOT NULL
      AND ${distanceExpr} <= :radius
      ${whereSql}
    `;

    const totalRes = await sequelize.query(countSql, {
      type: QueryTypes.SELECT,
      replacements: { ...replacements, ...extraRepl },
    });

    const total = totalRes?.[0]?.total ?? 0;

    // Select page with distance ordering
    const selectSql = `
      SELECT e.*,
        ${distanceExpr} AS distance_m
      FROM "Events" e
      WHERE e.lat IS NOT NULL AND e.lng IS NOT NULL
      AND ${distanceExpr} <= :radius
      ${whereSql}
      ORDER BY ${order.map(([f, d]) => `"${f}" ${d}`).join(", ")}
      LIMIT :limit OFFSET :offset
    `;

    const events = await sequelize.query(selectSql, {
      type: QueryTypes.SELECT,
      replacements: { ...replacements, ...extraRepl },
    });

    // Attach minimal related data: club and ticket types (batch fetch)
    const eventIds = events.map((r) => r.id);
    const tickets = eventIds.length
      ? await TicketType.findAll({ where: { eventId: eventIds } })
      : [];
    const clubs = [...new Set(events.map((e) => e.clubId).filter(Boolean))].length
      ? await Club.findAll({ where: { id: [...new Set(events.map((e) => e.clubId).filter(Boolean))] } })
      : [];

    const clubMap = new Map(clubs.map((c) => [c.id, c]));
    const ticketsMap = tickets.reduce((acc, t) => {
      acc[t.eventId] = acc[t.eventId] || [];
      acc[t.eventId].push(t);
      return acc;
    }, {});

    const payload = events.map((e) => ({
      ...e,
      distance_m: Number(e.distance_m),
      ticketTypes: ticketsMap[e.id] || [],
      club: e.clubId ? clubMap.get(e.clubId) || null : null,
    }));

    return {
      data: payload,
      meta: { total, page, limit },
    };
  }

  // No radius search; use Sequelize findAndCountAll with where, pagination and include
  const findOptions = {
    where,
    order,
    limit,
    offset,
    include: [
      {
        model: TicketType,
        as: "ticketTypes",
        required: false,
      },
      {
        model: Club,
        as: "club",
        required: false,
        attributes: ["id", "name", "slug", "city", "bannerUrl"],
      },
    ],
  };

  const { count, rows } = await Event.findAndCountAll(findOptions);

  return {
    data: rows,
    meta: { total: count, page, limit },
  };
}

module.exports = {
  listEvents,
};
