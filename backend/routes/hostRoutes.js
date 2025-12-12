// backend/routes/hostRoutes.js
const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/jwt");
const {
  getHostMetrics,
  getHostEvents,
  cancelHostEvent,
} = require("../controllers/hostController");

// All routes require authentication (host or admin)
router.get("/metrics", authenticate(["HOST", "ADMIN"]), getHostMetrics);
router.get("/events", authenticate(["HOST", "ADMIN"]), getHostEvents);

// Cancel an event (only organizer allowed — controller checks ownership)
router.post(
  "/events/:id/cancel",
  authenticate(["HOST", "ADMIN"]),
  cancelHostEvent
);

module.exports = router;
