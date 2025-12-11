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

// Setup Cashfree client
const cashfreeEnv =
  (process.env.CASHFREE_ENV || "SANDBOX").toUpperCase() === "PRODUCTION"
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;

const cashfree = new Cashfree(
  cashfreeEnv,
  process.env.CASHFREE_APP_ID,
  process.env.CASHFREE_SECRET_KEY
);

// Base URL for return / redirect (adjust in prod)
const BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:5000";

/**
 * ✅ 1️⃣ Create Cashfree order for an existing booking
 *
 * POST /payments/create-order
 * Body: { bookingId }
 */
const createOrderForBooking = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      await t.rollback();
      return res.status(400).json({ message: "bookingId is required" });
    }

    const booking = await Booking.findByPk(bookingId, {
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email"] },
        { model: Event, as: "event", attributes: ["id", "title"] },
        { model: Payment, as: "payment" },
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!booking) {
      await t.rollback();
      return res.status(404).json({ message: "Booking not found" });
    }

    if (String(booking.userId) !== String(req.user.id)) {
      await t.rollback();
      return res.status(403).json({ message: "You do not own this booking" });
    }

    if (booking.status !== "PENDING") {
      await t.rollback();
      return res.status(400).json({
        message: "Only PENDING bookings can be paid for",
      });
    }

    const amount = Number(booking.totalAmount || 0);
    if (!amount || amount <= 0) {
      await t.rollback();
      return res.status(400).json({
        message: "Booking amount is zero or invalid",
      });
    }

    // Make sure we have a Payment row
    let payment = booking.payment;
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

    // Build Cashfree order_id
    const cashfreeOrderId = `booking_${booking.id}`; // must be unique

    const request = {
      order_amount: amount,
      order_currency: booking.currency || "INR",
      order_id: cashfreeOrderId,
      customer_details: {
        customer_id: String(booking.userId),
        customer_phone: "9999999999", // TODO: add phone in User later
        customer_email: booking.user?.email || "customer@example.com",
        customer_name: booking.user?.name || "Customer",
      },
      order_meta: {
        return_url: `${BASE_URL}/index.html?booking_id=${booking.id}&order_id=${cashfreeOrderId}`,
      },
      order_note: booking.event
        ? `Booking for ${booking.event.title}`
        : "Event booking",
      order_expiry_time: new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString(),
    };

    const response = await cashfree.PGCreateOrder(request);
    const data = response.data;
    console.log("✅ Cashfree order created:", data);

    // Save providerOrderId + raw payload
    payment.providerOrderId = cashfreeOrderId;
    payment.status = "INITIATED";
    payment.rawPayload = data;
    await payment.save({ transaction: t });

    await t.commit();

    return res.status(200).json({
      success: true,
      bookingId: booking.id,
      order_id: cashfreeOrderId,
      payment_session_id: data.payment_session_id,
    });
  } catch (error) {
    console.error(
      "❌ Error creating Cashfree order:",
      error.response?.data || error
    );
    try {
      await t.rollback();
    } catch (e) {
      // ignore
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create Cashfree order",
    });
  }
};

/**
 * ✅ 2️⃣ Webhook to auto-update booking/payment status (Cashfree → us)
 *
 * POST /payments/cashfree/webhook
 */
const paymentWebhook = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const event = req.body;
    console.log("📦 Cashfree webhook received:", event);

    const orderId =
      event?.data?.order?.order_id || event?.order_id || event?.order?.order_id;
    const orderStatus =
      event?.data?.order?.order_status ||
      event?.order_status ||
      event?.order?.order_status;

    if (!orderId) {
      await t.rollback();
      console.warn("⚠️ Webhook missing order_id");
      return res.status(400).send("Missing order_id");
    }

    const payment = await Payment.findOne({
      where: { providerOrderId: orderId },
      include: [
        {
          model: Booking,
          as: "booking",
          include: [
            {
              model: Event,
              as: "event",
              attributes: ["id", "title", "organizerId"],
            },
            { model: User, as: "user", attributes: ["id", "name", "email"] },
          ],
        },
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!payment || !payment.booking) {
      await t.rollback();
      console.warn(`⚠️ Payment with providerOrderId ${orderId} not found`);
      return res.status(404).send("Payment not found");
    }

    const booking = payment.booking;

    // Update payment status
    if (orderStatus === "PAID" || orderStatus === "SUCCESS") {
      payment.status = "SUCCESS";
    } else if (orderStatus === "FAILED") {
      payment.status = "FAILED";
    } else if (orderStatus === "REFUNDED") {
      payment.status = "REFUNDED";
    } else {
      payment.status = orderStatus || payment.status;
    }

    payment.rawPayload = event;
    await payment.save({ transaction: t });

    // Handle booking according to payment status
    if (payment.status === "SUCCESS") {
      const now = new Date();
      const isExpired =
        booking.holdExpiresAt && new Date(booking.holdExpiresAt) < now;

      if (booking.status === "PENDING" && !isExpired) {
        booking.status = "CONFIRMED";

        // 1️⃣ QR + S3
        try {
          const qrBuffer = await generateBookingQr(booking);
          const key = `tickets/${booking.id}.png`;
          const qrUrl = await uploadPublicFile(qrBuffer, key, "image/png");
          booking.qrUrl = qrUrl;
        } catch (qrErr) {
          console.error("QR/S3 upload failed for booking", booking.id, qrErr);
        }

        await booking.save({ transaction: t });

        // 2️⃣ Wallet credit
        try {
          await creditOrganizerWalletForBooking({
            booking,
            payment,
            transaction: t,
          });
        } catch (walletErr) {
          console.error(
            "Wallet credit failed for booking",
            booking.id,
            walletErr
          );
        }

        // 3️⃣ Live seats update
        try {
          const io = getIo();
          const seats = await getEventSeatsSummary(booking.eventId, {
            transaction: t,
          });

          io.to(`event:${booking.eventId}`).emit("seats_update", {
            eventId: booking.eventId,
            seats,
          });
        } catch (sockErr) {
          console.error(
            "Socket seats_update emit failed for event",
            booking.eventId,
            sockErr
          );
        }
      }
    } else if (payment.status === "FAILED") {
      if (booking.status === "PENDING") {
        booking.status = "CANCELLED";
        await booking.save({ transaction: t });
      }
    } else if (payment.status === "REFUNDED") {
      if (booking.status === "CONFIRMED") {
        booking.status = "REFUNDED";
        await booking.save({ transaction: t });
      }
    }

    await t.commit();
    return res.status(200).send("Webhook processed successfully");
  } catch (err) {
    console.error("❌ Error processing Cashfree webhook:", err);
    try {
      await t.rollback();
    } catch (e) {}
    return res.status(500).send("Webhook processing failed");
  }
};

/**
 * ✅ 3️⃣ Route to check payment status via Cashfree API
 *
 * GET /payments/check/:orderId
 */
const checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const response = await cashfree.PGFetchOrder(orderId);
    const orderData = response.data;
    console.log("🔍 Fetched Cashfree order:", orderData);

    const transactions = orderData.transactions || [];
    let orderStatus;

    if (transactions.some((t) => t.payment_status === "SUCCESS")) {
      orderStatus = "SUCCESS";
    } else if (transactions.some((t) => t.payment_status === "PENDING")) {
      orderStatus = "PENDING";
    } else if (transactions.some((t) => t.payment_status === "FAILED")) {
      orderStatus = "FAILED";
    } else {
      orderStatus = orderData.order_status || "PENDING";
    }

    if (process.env.NODE_ENV === "development") {
      // Optional shortcut
      // orderStatus = "SUCCESS";
    }

    const payment = await Payment.findOne({
      where: { providerOrderId: orderId },
      include: [{ model: Booking, as: "booking" }],
    });

    if (payment) {
      payment.status = orderStatus;
      await payment.save();

      if (payment.booking) {
        if (orderStatus === "SUCCESS" && payment.booking.status === "PENDING") {
          payment.booking.status = "CONFIRMED";
          await payment.booking.save();
        }
        if (orderStatus === "FAILED" && payment.booking.status === "PENDING") {
          payment.booking.status = "CANCELLED";
          await payment.booking.save();
        }
      }
    }

    return res.status(200).json({
      success: true,
      orderStatus,
      cashfreeResponse: orderData,
    });
  } catch (error) {
    console.error("❌ Error checking payment status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check payment status",
      error: error.response?.data || error.message,
    });
  }
};

/**
 * ✅ 4️⃣ Simple API to read payment status from DB
 *
 * GET /payments/order/:orderId
 */
const orderStatusFromDb = async (req, res) => {
  try {
    const { orderId } = req.params;
    const payment = await Payment.findOne({
      where: { providerOrderId: orderId },
    });

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    return res.json({ success: true, status: payment.status });
  } catch (err) {
    console.error("❌ Error fetching order:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  createOrderForBooking,
  paymentWebhook,
  checkPaymentStatus,
  orderStatusFromDb,
};
