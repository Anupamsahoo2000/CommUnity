// src/routes/club.routes.js
const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/jwt");

const {
  createClub,
  listClubs,
  getClub,
  updateClub,
  joinClub,
  getClubMembers,
  deleteClub,
  leaveClub,
  getClubChat,
  postClubChat,
  uploadClubBanner,
} = require("../controllers/clubController");
const upload = require("../middleware/upload");

// Public listing & details
router.get("/", listClubs);
router.get("/:id", getClub);

// Club chat
router.get("/:id/chat", getClubChat);
router.post("/:id/chat", authenticate(), postClubChat);

// Protected routes
// Create: any authenticated user
router.post("/", authenticate(), createClub);

// Update: only club owner or ADMIN (middleware enforces)
router.put("/:id", authenticate(), updateClub);

// Delete: only club owner or ADMIN (middleware enforces)
// supports ?force=true for cascade delete (controller handles that)
router.delete("/:id", authenticate(), deleteClub);
// Join club (authenticated)
router.post("/:id/join", authenticate(), joinClub);

router.post(
  "/:id/banner",
  authenticate(["HOST", "ADMIN"]),
  upload.single("banner"),
  uploadClubBanner
);

// Members (requires authenticated)
router.get("/:id/members", authenticate(), getClubMembers);
router.post("/:id/leave", authenticate(), leaveClub);

module.exports = router;
