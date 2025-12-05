// backend/src/routes/event.routes.js
const express = require("express");
const router = express.Router();
const {
  getEvents,
  createEvent,
  updateEvent,
} = require("../controllers/eventController");
const authenticate = require("../middleware/jwt");

// Public list
router.get("/", getEvents);

// Protected: create (HOST or ADMIN)
router.post("/", authenticate(["HOST", "ADMIN"]), createEvent);

// Protected: update (organizer/club-owner check performed in controller)
router.put("/:id", authenticate(["HOST", "ADMIN"]), updateEvent);

module.exports = router;
