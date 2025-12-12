// backend/routes/aiRoutes.js
const express = require("express");
const router = express.Router();
const {
  predictiveTyping,
  smartReplies,
} = require("../controllers/chatAIController");

router.post("/predictive", predictiveTyping);
router.post("/smart-replies", smartReplies);

module.exports = router;
