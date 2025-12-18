// backend/controllers/paymentController.js
const { Cashfree, CFEnvironment } = require("cashfree-pg");
require("dotenv").config();
const sequelize = require("../config/db");

const {
  Booking,
  Payment,
  User,
  Event,
  Wallet,
  WalletTransaction,
} = require("../models/sql");

const { uploadPublicFile } = require("../utils/s3");
const { generateBookingQr } = require("../utils/qr");
const {
  creditOrganizerWalletForBooking,
} = require("../services/walletService");
const { getIo } = require("../config/socket");
const { getEventSeatsSummary } = require("../services/seatsService");

// ---------------- CASHFREE SETUP ----------------
const cashfreeEnv =
  (process.env.CASHFREE_ENV || "SANDBOX").toUpperCase() === "PRODUCTION"
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;

const cashfree = new Cashfree(
  cashfreeEnv,
  process.env.CASHFREE_APP_ID,
  process.env.CASHFREE_SECRET_KEY
);

const BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:5000";

/* =====================================================
   1️⃣ CREATE CASHFREE ORDER (FIXED)
   ===================================================== */
const createOrderForBooking = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      await t.rollback();
      return res.status(400).json({ message: "bookingId is required" });
    }

    // 🔒 Lock ONLY booking row
    const booking = await Booking.findOne({
      where: { id: bookingId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!booking) {
      await t.rollback();
      return res.status(404).json({ message: "Booking not found" });
    }

    if (String(booking.userId) !== String(req.user.id)) {
      await t.rollback();
      return res.status(403).json({ message: "Not your booking" });
    }

    if (booking.status !== "PENDING") {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Only PENDING bookings can be paid" });
    }

    const amount = Number(booking.totalAmount || 0);
    if (!amount || amount <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid booking amount" });
    }

    // 🔹 Fetch relations WITHOUT lock
    const [user, event] = await Promise.all([
      User.findByPk(booking.userId, {
        attributes: ["id", "name", "email"],
        transaction: t,
      }),
      Event.findByPk(booking.eventId, {
        attributes: ["id", "title"],
        transaction: t,
      }),
    ]);

    // 🔹 Ensure Payment row
    let payment = await Payment.findOne({
      where: { bookingId: booking.id },
      transaction: t,
    });

    if (!payment) {
      payment = await Payment.create(
        {
          bookingId: booking.id,
          provider: "CASHFREE",
          status: "INITIATED",
          amount,
          currency: booking.currency || "INR",
        },
        { transaction: t }
      );
    }

    const cashfreeOrderId = `booking_${booking.id}`;

    const request = {
      order_id: cashfreeOrderId,
      order_amount: amount,
      order_currency: booking.currency || "INR",
      customer_details: {
        customer_id: String(booking.userId),
        customer_email: user?.email || "customer@example.com",
        customer_name: user?.name || "Customer",
        customer_phone: "9999999999",
      },
      order_meta: {
        return_url: `${BASE_URL}/event.html?id=${booking.eventId}&booking_id=${booking.id}`,
      },
      order_note: event ? `Booking for ${event.title}` : "Event booking",

      payment_methods: {
        upi: true,
        card: true,
        netbanking: true,
        wallet: true,
      },
    };

    const response = await cashfree.PGCreateOrder(request);
    const data = response.data;

    payment.providerOrderId = cashfreeOrderId;
    payment.status = "INITIATED";
    payment.rawPayload = data;
    await payment.save({ transaction: t });

    await t.commit();

    return res.json({
      success: true,
      bookingId: booking.id,
      order_id: cashfreeOrderId,
      payment_session_id: data.payment_session_id,
    });
  } catch (err) {
    console.error("❌ createOrderForBooking error:", err);
    await t.rollback();
    return res.status(500).json({
      success: false,
      message: "Failed to create Cashfree order",
    });
  }
};

/* =====================================================
   2️⃣ CASHFREE WEBHOOK (FIXED LOCKING)
   ===================================================== */
const paymentWebhook = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payload = req.body;

    const orderId =
      payload?.data?.order?.order_id ||
      payload?.order_id ||
      payload?.order?.order_id;

    const orderStatus =
      payload?.data?.order?.order_status ||
      payload?.order_status ||
      payload?.order?.order_status;

    if (!orderId) {
      await t.rollback();
      return res.status(400).send("Missing order_id");
    }

    // 🔒 Lock ONLY payment
    const payment = await Payment.findOne({
      where: { providerOrderId: orderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!payment) {
      await t.rollback();
      return res.status(404).send("Payment not found");
    }

    const booking = await Booking.findByPk(payment.bookingId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!booking) {
      await t.rollback();
      return res.status(404).send("Booking not found");
    }

    // Update payment status
    if (["PAID", "SUCCESS"].includes(orderStatus)) {
      payment.status = "SUCCESS";
    } else if (orderStatus === "FAILED") {
      payment.status = "FAILED";
    } else if (orderStatus === "REFUNDED") {
      payment.status = "REFUNDED";
    }

    payment.rawPayload = payload;
    await payment.save({ transaction: t });

    // Booking transitions
    if (payment.status === "SUCCESS" && booking.status === "PENDING") {
      booking.status = "CONFIRMED";

      // QR + S3
      try {
        const qr = await generateBookingQr(booking);
        booking.qrUrl = await uploadPublicFile(
          qr,
          `tickets/${booking.id}.png`,
          "image/png"
        );
      } catch (e) {
        console.error("QR upload failed", e);
      }

      await booking.save({ transaction: t });

      // Wallet credit
      await creditOrganizerWalletForBooking({
        booking,
        payment,
        transaction: t,
      });

      // Seats update
      const io = getIo();
      const seats = await getEventSeatsSummary(booking.eventId, {
        transaction: t,
      });

      io.to(`event:${booking.eventId}`).emit("seats_update", {
        eventId: booking.eventId,
        seats,
      });
    }

    if (payment.status === "FAILED" && booking.status === "PENDING") {
      booking.status = "CANCELLED";
      await booking.save({ transaction: t });
    }

    await t.commit();
    return res.status(200).send("Webhook processed");
  } catch (err) {
    console.error("❌ paymentWebhook error:", err);
    await t.rollback();
    return res.status(500).send("Webhook failed");
  }
};

/* =====================================================
   3️⃣ CHECK PAYMENT STATUS
   ===================================================== */
const checkPaymentStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    // 🔒 Lock payment
    const payment = await Payment.findOne({
      where: { providerOrderId: orderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!payment) {
      await t.rollback();
      return res.status(404).json({ message: "Payment not found" });
    }

    const booking = await Booking.findByPk(payment.bookingId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!booking) {
      await t.rollback();
      return res.status(404).json({ message: "Booking not found" });
    }

    let finalStatus = "PENDING";

    // 🔥 SANDBOX / DEV → FORCE SUCCESS
    if (process.env.NODE_ENV !== "production") {
      finalStatus = "SUCCESS";
    } else {
      // PROD → Ask Cashfree
      const response = await cashfree.PGFetchOrder(orderId);
      const order = response.data;

      if (order?.order_status === "PAID") {
        finalStatus = "SUCCESS";
      } else if (order?.order_status === "FAILED") {
        finalStatus = "FAILED";
      }
    }

    // Update payment
    payment.status = finalStatus;
    await payment.save({ transaction: t });

    // Update booking
    if (finalStatus === "SUCCESS" && booking.status === "PENDING") {
      booking.status = "CONFIRMED";

      // QR + S3
      try {
        const qr = await generateBookingQr(booking);
        booking.qrUrl = await uploadPublicFile(
          qr,
          `tickets/${booking.id}.png`,
          "image/png"
        );
      } catch (e) {
        console.error("QR generation failed", e);
      }

      await booking.save({ transaction: t });

      // Wallet credit
      await creditOrganizerWalletForBooking({
        booking,
        payment,
        transaction: t,
      });
    }

    await t.commit();

    return res.json({
      success: true,
      status: finalStatus,
      bookingId: booking.id,
    });
  } catch (err) {
    await t.rollback();
    console.error("checkPaymentStatus error:", err);
    return res.status(500).json({ message: "Failed to check payment status" });
  }
};

/* =====================================================
   4️⃣ READ STATUS FROM DB
   ===================================================== */
const orderStatusFromDb = async (req, res) => {
  const payment = await Payment.findOne({
    where: { providerOrderId: req.params.orderId },
  });

  if (!payment) {
    return res.status(404).json({ message: "Order not found" });
  }

  return res.json({ success: true, status: payment.status });
};

module.exports = {
  createOrderForBooking,
  paymentWebhook,
  checkPaymentStatus,
  orderStatusFromDb,
};
