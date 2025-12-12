const express = require("express");
const router = express.Router();
const {
  getEvents,
  createEvent,
  updateEvent,
  getEventTickets,
  getEventSeats,
  getEventById,
  createTicketType,
  getEventChat,
  postEventChat,
  uploadEventBanner,
} = require("../controllers/eventController");
const authenticate = require("../middleware/jwt");
const upload = require("../middleware/upload");

// Public list
router.get("/", getEvents);

// Public tickets & seats
router.get("/:id/tickets", getEventTickets);
router.get("/:id/seats", getEventSeats);

// Public single event (MUST come after /tickets and /seats)
router.get("/:id", getEventById);

// Host/Admin: create ticket type for an event
router.post("/:id/tickets", authenticate(["HOST", "ADMIN"]), createTicketType);

// 🔹 Event chat
router.get("/:id/chat", getEventChat);
router.post("/:id/chat", authenticate(), postEventChat);

// Upload banner image for an event
router.post(
  "/:id/banner",
  authenticate(["HOST", "ADMIN"]),
  upload.single("banner"),
  uploadEventBanner
);

// Protected: create / update event
router.post("/", authenticate(["HOST", "ADMIN"]), createEvent);
router.put("/:id", authenticate(["HOST", "ADMIN"]), updateEvent);

module.exports = router;
