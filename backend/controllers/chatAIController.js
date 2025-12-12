// backend/controllers/chatAIController.js
const { getPredictiveText, getSmartReplies } = require("../config/ai");

const predictiveTyping = async (req, res) => {
  try {
    const { text } = req.body;
    const suggestions = await getPredictiveText(text);
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ message: "AI error", error: err.message });
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
