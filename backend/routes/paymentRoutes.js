// backend/routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/jwt");
const {
  createOrderForBooking,
  paymentWebhook,
  checkPaymentStatus,
  orderStatusFromDb,
} = require("../controllers/paymentController");

// Create Cashfree order for a booking (user must be logged in)
router.post("/create-order", authenticate(), createOrderForBooking);

// Webhook (Cashfree server → your backend)
// ⚠️ do NOT put authenticate() here, use signature verification instead
router.post("/webhook", paymentWebhook);

// Check status via Cashfree API
router.get("/check/:orderId", authenticate(), checkPaymentStatus);

// Check status from DB only
router.get("/order/:orderId", authenticate(), orderStatusFromDb);

module.exports = router;
