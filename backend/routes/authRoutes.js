const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  getUserProfile,
} = require("../controllers/authController");
const authenticate = require("../middleware/jwt");

// Public routes
router.post("/register", signup);
router.post("/login", login);

// Protected route
router.get("/me", authenticate(), getUserProfile);

module.exports = router;
