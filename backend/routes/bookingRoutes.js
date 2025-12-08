// backend/routes/bookingRoutes.js
const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/jwt");
const {
  createBooking,
  getMyBookings,
  cancelBooking,
} = require("../controllers/bookingController");

// Create a booking (requires auth)
router.post("/", authenticate(), createBooking);

// Current user's bookings
router.get("/me", authenticate(), getMyBookings);

// Cancel a booking (owned by user)
router.post("/:id/cancel", authenticate(), cancelBooking);

module.exports = router;
