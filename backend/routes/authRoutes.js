const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  getUserProfile,
  uploadAvatar,
} = require("../controllers/authController");
const authenticate = require("../middleware/jwt");
const upload = require("../middleware/upload");

// Public routes
router.post("/register", signup);
router.post("/login", login);

// Protected route
router.get("/me", authenticate(), getUserProfile);

router.post(
  "/me/avatar",
  authenticate(),
  upload.single("avatar"),
  uploadAvatar
);

module.exports = router;
