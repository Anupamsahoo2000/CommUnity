// backend/routes/hostRoutes.js
const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/jwt");
const cacheMiddleware = require("../middleware/cacheMiddleware");
const {
  getHostMetrics,
  getHostEvents,
  cancelHostEvent,
  getHostBookings,
  getHostClubs,
  deleteHostClub,
} = require("../controllers/hostController");

// All routes require authentication (host or admin)
router.get("/metrics", authenticate(["HOST", "ADMIN"]), cacheMiddleware(60), getHostMetrics);
router.get("/clubs", authenticate(["HOST", "ADMIN"]), cacheMiddleware(60), getHostClubs);
router.get("/events", authenticate(["HOST", "ADMIN"]), cacheMiddleware(60), getHostEvents);

// Cancel an event (only organizer allowed — controller checks ownership)
router.post(
  "/events/:id/cancel",
  authenticate(["HOST", "ADMIN"]),
  cancelHostEvent
);

// Delete a club (only owner allowed — controller checks ownership)
router.delete("/clubs/:id", authenticate(["HOST", "ADMIN"]), deleteHostClub);

router.get("/bookings", authenticate(["HOST", "ADMIN"]), cacheMiddleware(60), getHostBookings);

module.exports = router;
