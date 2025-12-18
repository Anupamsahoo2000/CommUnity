// backend/routes/bookingRoutes.js
const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/jwt");
const {
  createBooking,
  getMyBookings,
  cancelBooking,
  expireStaleBookings,
  updateBookingStatus,
  deleteBooking,
} = require("../controllers/bookingController");

// Create a booking (requires auth)
router.post("/", authenticate(), createBooking);

// Current user's bookings
router.get("/me", authenticate(), getMyBookings);

// Cancel a booking (owned by user)
router.post("/:id/cancel", authenticate(), cancelBooking);

// Expire stale bookings (can be called by a cron job or manually)
router.post("/expire-holds", expireStaleBookings);

router.put("/:id/status", authenticate(["HOST", "ADMIN"]), updateBookingStatus);
router.delete("/:id", authenticate(["HOST", "ADMIN"]), deleteBooking);

module.exports = router;
