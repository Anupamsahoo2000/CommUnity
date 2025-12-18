// backend/controllers/chatAIController.js
const { getPredictiveText, getSmartReplies } = require("../config/ai");

const predictiveTyping = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await getPredictiveText(text);
    return res.json({ suggestions });
  } catch (err) {
    // 🔴 QUOTA / RATE LIMIT HANDLING
    if (err.status === 429) {
      console.warn("Gemini quota exceeded – fallback used");
      return res.json({ suggestions: [] }); // graceful fallback
    }

    console.error("Predictive typing failed:", err);
    return res.json({ suggestions: [] });
  }
};

const smartReplies = async (req, res) => {
  try {
    const { message } = req.body;
    const replies = await getSmartReplies(message);
    res.json({ replies });
  } catch (err) {
    res.status(500).json({ message: "AI error", error: err.message });
  }
};

module.exports = { predictiveTyping, smartReplies };
