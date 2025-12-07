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
} = require("../controllers/clubController");

// Public listing & details
router.get("/", listClubs);
router.get("/:id", getClub);

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

// Members (requires authenticated)
router.get("/:id/members", authenticate(), getClubMembers);
router.post("/:id/leave", authenticate(), leaveClub);

module.exports = router;
