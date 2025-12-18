// backend/controllers/hostController.js
const { Op, fn, col, literal } = require("sequelize");
const sequelize = require("../config/db");

const {
  Event,
  Booking,
  Payment,
  Wallet,
  WalletTransaction,
  User,
  TicketType,
} = require("../models/sql");

/**
 * GET /hosts/metrics
 * Return: { totalRevenue, activeEvents, totalBookings, walletBalance }
 */

const getHostMetrics = async (req, res) => {
  try {
    const hostId = req.user?.id;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });

    const activeEvents = await Event.count({
      where: { organizerId: hostId, status: "PUBLISHED" },
    });

    const totalBookings = await Booking.count({
      include: [
        {
          model: Event,
          as: "event",
          required: true,
          where: { organizerId: hostId },
        },
      ],
    });

    const revenueRow = await Payment.findOne({
      attributes: [
        [fn("COALESCE", fn("SUM", col("Payment.amount")), 0), "totalRevenue"],
      ],
      where: { status: "SUCCESS" },
      include: [
        {
          model: Booking,
          as: "booking",
          attributes: [],
          required: true,
          include: [
            {
              model: Event,
              as: "event",
              attributes: [],
              required: true,
              where: { organizerId: hostId },
            },
          ],
        },
      ],
      raw: true,
      subQuery: false,
    });

    return res.json({
      totalRevenue: Number(revenueRow.totalRevenue),
      activeEvents,
      totalBookings,
      walletBalance: null,
    });
  } catch (err) {
    console.error("getHostMetrics error:", err);
    return res.status(500).json({ message: "Failed to fetch host metrics" });
  }
};

/**
 * GET /hosts/events
 * Return list of events for current host with bookings count and revenue per event.
 */
const getHostEvents = async (req, res) => {
  try {
    const hostId = req.user?.id;
    if (!hostId) return res.status(401).json({ message: "Unauthorized" });

    // We'll fetch events and LEFT JOIN aggregates for bookings count and revenue
    // Use raw SQL-ish style via sequelize.fn and group
    const events = await Event.findAll({
      where: { organizerId: hostId },
      attributes: [
        "id",
        "title",
        "status",
        "startTime",
        "endTime",
        "city",
        "bannerUrl",
        "createdAt",
        // bookingsCount: COUNT(bookings.id)
        [fn("COALESCE", fn("COUNT", col("bookings.id")), 0), "bookingsCount"],
        // revenue: SUM(payment.netAmount) for payments related to bookings of this event
        [
          fn("COALESCE", fn("SUM", col("bookings->payment.netAmount")), 0),
          "revenue",
        ],
      ],
      include: [
        {
          model: Booking,
          as: "bookings",
          attributes: [],
          required: false,
          include: [
            {
              model: Payment,
              as: "payment",
              attributes: [],
              required: false,
            },
          ],
        },
      ],
      group: ["Event.id"],
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    // Normalize numeric fields
    const formatted = events.map((e) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      startTime: e.startTime,
      city: e.city,
      bannerUrl: e.bannerUrl,
      bookingsCount: Number(e.bookingsCount || 0),
      revenue: Number(e.revenue || 0),
      createdAt: e.createdAt,
    }));

    return res.json({ events: formatted });
  } catch (err) {
    console.error("getHostEvents error:", err);
    return res.status(500).json({ message: "Failed to fetch host events" });
  }
};

/**
 * POST /hosts/events/:id/cancel
 * - Verify ownership
 * - Mark event.status = 'CANCELLED'
 * - For bookings:
 *    - If PENDING => CANCELLED
 *    - If CONFIRMED => mark CANCELLED and create a wallet reversal (basic bookkeeping)
 * Note: This does NOT call Cashfree refund API. You should integrate gateway refund calls separately.
 */
const cancelHostEvent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const hostId = req.user?.id;
    if (!hostId) {
      await t.rollback();
      return res.status(401).json({ message: "Unauthorized" });
    }

    const eventId = req.params.id;
    const event = await Event.findByPk(eventId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!event) {
      await t.rollback();
      return res.status(404).json({ message: "Event not found" });
    }

    if (String(event.organizerId) !== String(hostId)) {
      await t.rollback();
      return res.status(403).json({ message: "You do not own this event" });
    }

    // idempotent: if already cancelled/completed, don't allow
    if (event.status === "CANCELLED" || event.status === "COMPLETED") {
      await t.rollback();
      return res.status(400).json({ message: `Event already ${event.status}` });
    }

    // 1) Mark event cancelled
    event.status = "CANCELLED";
    await event.save({ transaction: t });

    // 2) Load bookings for event
    const bookings = await Booking.findAll({
      where: { eventId: event.id },
      include: [{ model: Payment, as: "payment" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // 3) Process bookings
    for (const booking of bookings) {
      // If pending -> cancel and free seats (seatsService will be responsible for actual seat counts)
      if (booking.status === "PENDING") {
        booking.status = "CANCELLED";
        await booking.save({ transaction: t });
      } else if (booking.status === "CONFIRMED") {
        // Mark cancelled; real refunds should be processed via payment gateway.
        booking.status = "CANCELLED";
        await booking.save({ transaction: t });

        const payment = booking.payment;
        // Simple bookkeeping: if platform already credited organizer wallet for this booking,
        // try to reverse that from organizer wallet. This is basic and may need adjustment.
        if (payment && payment.status === "SUCCESS") {
          // find organizer wallet
          const organizerWallet = await Wallet.findOne({
            where: { organizerId: hostId },
            transaction: t,
            lock: t.LOCK.UPDATE,
          });

          const net = Number(payment.netAmount || 0);
          if (organizerWallet && net && net > 0) {
            // Deduct net from available balance (if possible) and create reversal transaction
            organizerWallet.balanceAvailable = Number(
              (Number(organizerWallet.balanceAvailable || 0) - net).toFixed(2)
            );
            if (organizerWallet.balanceAvailable < 0) {
              // Do not allow negative wallet balance in DB; set to 0 and keep record
              organizerWallet.balanceAvailable = 0;
            }
            await organizerWallet.save({ transaction: t });

            await WalletTransaction.create(
              {
                walletId: organizerWallet.id,
                type: "REVERSAL",
                amount: net,
                referenceType: "EVENT_CANCEL",
                referenceId: event.id,
                description: `Reversal for cancelled booking ${booking.id}`,
                meta: { bookingId: booking.id, paymentId: payment.id },
              },
              { transaction: t }
            );
          }

          // Mark payment as REFUNDED in DB for bookkeeping (you still must call gateway refund)
          payment.status = "REFUNDED";
          await payment.save({ transaction: t });
        }
      } else {
        // other statuses — mark cancelled for safety
        booking.status = "CANCELLED";
        await booking.save({ transaction: t });
      }
    }

    await t.commit();
    return res.json({ message: "Event cancelled and bookings updated" });
  } catch (err) {
    console.error("cancelHostEvent error:", err);
    await t.rollback();
    return res.status(500).json({ message: "Failed to cancel event" });
  }
};

const getHostBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let whereEvent = {};

    // HOST → only own events
    if (role === "HOST") {
      whereEvent.organizerId = userId;
    }

    const bookings = await Booking.findAll({
      attributes: [
        "id",
        "status",
        "quantity",
        "totalAmount", // ✅ IMPORTANT
        "currency",
        "createdAt",
      ],
      include: [
        {
          model: Event,
          as: "event",
          where: whereEvent,
          attributes: ["id", "title", "organizerId"],
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
        },
        {
          model: TicketType,
          as: "ticketType",
          attributes: ["id", "name", "price"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({ bookings });
  } catch (err) {
    console.error("getHostBookings error:", err);
    return res.status(500).json({ message: "Failed to load bookings" });
  }
};

module.exports = {
  getHostMetrics,
  getHostEvents,
  cancelHostEvent,
  getHostBookings,
};
