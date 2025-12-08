// backend/controllers/bookingController.js
const sequelize = require("sequelize");
const { Op } = sequelize;
const { Booking, Payment, Event, TicketType, User } = require("../models/sql");
const { ensureSeatsAvailable } = require("../services/seatsService");

/**
 * POST /api/bookings
 * Body: { eventId, ticketTypeId, quantity }
 * Auth: required
 *
 * Flow:
 *  - check event & ticket type
 *  - ensure seats are available
 *  - create Booking (PENDING) with holdExpiresAt
 *  - create Payment (INITIATED)
 *  - (later) call Cashfree to create order and save providerOrderId
 */
const createBooking = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userId = req.user?.id;
    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { eventId, ticketTypeId, quantity } = req.body;

    const qty = Number(quantity || 1);
    if (!eventId || !ticketTypeId || !qty || qty <= 0) {
      await t.rollback();
      return res
        .status(400)
        .json({
          message: "eventId, ticketTypeId and quantity > 0 are required",
        });
    }

    // 1) Load event
    const event = await Event.findByPk(eventId, {
      transaction: t,
    });

    if (!event) {
      await t.rollback();
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.status !== "PUBLISHED") {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Bookings are allowed only for published events." });
    }

    const now = new Date();
    if (event.startTime && new Date(event.startTime) < now) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Event has already started or ended." });
    }

    // 2) Check ticket type & availability (uses 3B service)
    const ticket = await ensureSeatsAvailable({
      eventId: event.id,
      ticketTypeId,
      quantity: qty,
      transaction: t,
    });

    const unitPrice = Number(ticket.price || 0);
    const totalAmount = unitPrice * qty;

    // 3) Create Booking (PENDING) with seat hold
    const HOLD_MINUTES = 15; // adjust as you like
    const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);

    const booking = await Booking.create(
      {
        userId,
        eventId: event.id,
        ticketTypeId,
        quantity: qty,
        status: "PENDING",
        totalAmount,
        currency: "INR",
        holdExpiresAt,
      },
      { transaction: t }
    );

    // 4) Create Payment row (INITIATED)
    const payment = await Payment.create(
      {
        bookingId: booking.id,
        provider: "CASHFREE",
        status: "INITIATED",
        amount: totalAmount,
        currency: "INR",
      },
      { transaction: t }
    );

    // 5) (TODO) Call Cashfree API → create order
    //
    // Here you will:
    //  - use Cashfree SDK or axios to create an order
    //  - get providerOrderId, payment link, etc.
    //
    // For now, we return a mocked paymentLink so you can test frontend.
    //
    const mockPaymentLink = `https://example.com/mock-pay?bookingId=${booking.id}`;

    await t.commit();

    return res.status(201).json({
      booking: {
        id: booking.id,
        status: booking.status,
        quantity: booking.quantity,
        totalAmount: Number(booking.totalAmount || 0),
        currency: booking.currency,
        holdExpiresAt: booking.holdExpiresAt,
      },
      payment: {
        id: payment.id,
        provider: payment.provider,
        status: payment.status,
        amount: Number(payment.amount || 0),
        currency: payment.currency,
        providerOrderId: payment.providerOrderId || null,
      },
      cashfree: {
        paymentLink: mockPaymentLink,
        // later: embed Cashfree-specific session/order data
      },
    });
  } catch (err) {
    console.error("createBooking error:", err);
    await t.rollback();
    const status = err.statusCode || 500;
    return res
      .status(status)
      .json({ message: err.message || "Failed to create booking" });
  }
};

/**
 * GET /api/bookings/me
 * Returns current user's bookings with event + ticket info
 */
const getMyBookings = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const bookings = await Booking.findAll({
      where: { userId },
      include: [
        {
          model: Event,
          as: "event",
          attributes: ["id", "title", "bannerUrl", "startTime", "city"],
        },
        {
          model: TicketType,
          as: "ticketType",
          attributes: ["id", "name", "price"],
        },
        {
          model: Payment,
          as: "payment",
          attributes: ["id", "status", "provider", "amount", "currency"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Shape for frontend (matches your dashboard.js expectations)
    const formatted = bookings.map((b) => ({
      id: b.id,
      status: b.status,
      quantity: b.quantity,
      totalAmount: Number(b.totalAmount || 0),
      currency: b.currency,
      qrUrl: b.qrUrl || null,
      createdAt: b.createdAt,
      // for dashboard card
      ticketType: b.ticketType ? b.ticketType.name : null,
      event: b.event
        ? {
            id: b.event.id,
            title: b.event.title,
            bannerUrl: b.event.bannerUrl,
            startTime: b.event.startTime,
            city: b.event.city,
          }
        : null,
      payment: b.payment
        ? {
            id: b.payment.id,
            status: b.payment.status,
            provider: b.payment.provider,
            amount: Number(b.payment.amount || 0),
            currency: b.payment.currency,
          }
        : null,
    }));

    return res.json({ data: formatted });
  } catch (err) {
    console.error("getMyBookings error:", err);
    return res.status(500).json({ message: "Failed to load your bookings" });
  }
};

/**
 * POST /api/bookings/:id/cancel
 * Simple cancellation stub (no actual refund yet).
 * Rules:
 *  - user must own the booking (or be ADMIN, we’ll keep it simple: only owner for now)
 *  - booking status must be PENDING or CONFIRMED
 *  - event must be in future
 */
const cancelBooking = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userId = req.user?.id;
    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: "Unauthorized" });
    }

    const bookingId = req.params.id;

    const booking = await Booking.findOne({
      where: { id: bookingId, userId },
      include: [{ model: Event, as: "event", attributes: ["id", "startTime"] }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!booking) {
      await t.rollback();
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Booking cannot be cancelled in its current state" });
    }

    const now = new Date();
    if (booking.event?.startTime && new Date(booking.event.startTime) < now) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Event has already started; cannot cancel" });
    }

    // TODO: integrate actual refund via Cashfree if status === CONFIRMED
    // For now, just mark CANCELLED and free up seats logically
    booking.status = "CANCELLED";
    await booking.save({ transaction: t });

    await t.commit();
    return res.json({ message: "Booking cancelled", bookingId: booking.id });
  } catch (err) {
    console.error("cancelBooking error:", err);
    await t.rollback();
    return res.status(500).json({ message: "Failed to cancel booking" });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking,
};
