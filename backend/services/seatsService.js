// backend/services/seatsService.js
const sequelize = require("../config/db");
const { Op } = require("sequelize");
const { TicketType, Booking } = require("../models/sql/index");

/**
 * Compute availability for all ticket types of an event.
 * Rule:
 *   used = SUM(quantity) for bookings where:
 *     - ticketTypeId in those tickets
 *     - status IN (PENDING, CONFIRMED)
 *     - and (status != 'PENDING' OR holdExpiresAt > now)
 *
 * available = quota - used
 */
async function getEventTicketsWithAvailability(eventId, options = {}) {
  const { transaction } = options;
  const now = new Date();

  // 1) Get all active ticket types for this event
  const tickets = await TicketType.findAll({
    where: { eventId, isActive: true },
    order: [["price", "ASC"]],
    transaction,
  });

  if (!tickets.length) {
    return {
      tickets: [],
      summary: { totalQuota: 0, totalUsed: 0, totalAvailable: 0 },
    };
  }

  const ticketIds = tickets.map((t) => t.id);

  // 2) Aggregate bookings usage for those tickets
  const usedRows = await Booking.findAll({
    where: {
      eventId,
      ticketTypeId: { [Op.in]: ticketIds },
      status: { [Op.in]: ["PENDING", "CONFIRMED"] },
      [Op.or]: [
        { status: "CONFIRMED" },
        { status: "PENDING", holdExpiresAt: { [Op.gt]: now } },
      ],
    },
    attributes: [
      "ticketTypeId",
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn("SUM", sequelize.col("quantity")),
          0
        ),
        "used",
      ],
    ],
    group: ["ticketTypeId"],
    raw: true,
    transaction,
  });

  const usedMap = usedRows.reduce((acc, row) => {
    acc[row.ticketTypeId] = Number(row.used || 0);
    return acc;
  }, {});

  let totalQuota = 0;
  let totalUsed = 0;

  const enrichedTickets = tickets.map((t) => {
    const quota = Number(t.quota || 0);
    const used = usedMap[t.id] || 0;
    const available = Math.max(0, quota - used);

    totalQuota += quota;
    totalUsed += used;

    return {
      id: t.id,
      name: t.name,
      description: t.description,
      price: Number(t.price || 0),
      quota,
      usedSeats: used,
      availableSeats: available,
      salesStart: t.salesStart,
      salesEnd: t.salesEnd,
      isActive: t.isActive,
    };
  });

  const totalAvailable = Math.max(0, totalQuota - totalUsed);

  return {
    tickets: enrichedTickets,
    summary: {
      totalQuota,
      totalUsed,
      totalAvailable,
    },
  };
}

/**
 * Lightweight summary for /api/events/:id/seats
 */
async function getEventSeatsSummary(eventId, options = {}) {
  const { tickets, summary } = await getEventTicketsWithAvailability(
    eventId,
    options
  );

  return {
    eventId,
    tickets,
    ...summary,
  };
}

/**
 * Helper to be used in booking controller later:
 * Throws an error if requested quantity > available.
 */
async function ensureSeatsAvailable({
  eventId,
  ticketTypeId,
  quantity,
  transaction,
}) {
  const { tickets } = await getEventTicketsWithAvailability(eventId, {
    transaction,
  });
  const ticket = tickets.find((t) => String(t.id) === String(ticketTypeId));

  if (!ticket) {
    const err = new Error("Ticket type not found or inactive for this event");
    err.statusCode = 400;
    throw err;
  }

  if (ticket.availableSeats < quantity) {
    const err = new Error("Not enough seats available for this ticket type");
    err.statusCode = 400;
    throw err;
  }

  return ticket; // include availability data if caller wants it
}

module.exports = {
  getEventTicketsWithAvailability,
  getEventSeatsSummary,
  ensureSeatsAvailable,
};
