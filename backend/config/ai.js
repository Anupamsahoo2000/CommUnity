// backend/config/ai.js

const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

function cleanAIResponse(text) {
  if (!text) return "";

  return text
    .replace(/```[\s\S]*?```/g, "") // remove fenced code blocks
    .replace(/`/g, "") // remove stray backticks
    .trim();
}

/**
 * Predictive typing - Suggest the next word or phrase
 */
async function getPredictiveText(partialMessage) {
  try {
    const prompt = `
      You are a predictive typing assistant for a chat app.
      The user is typing a message: "${partialMessage}"
      Suggest 3 possible next words or short phrases.
      Return ONLY a JSON array of strings. No markdown.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    let text = cleanAIResponse(response.text?.trim());

    try {
      return JSON.parse(text);
    } catch {
      return text
        .replace(/[\[\]"]/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } catch (error) {
    console.error("AI predictive typing error:", error);
    return [];
  }
}

/**
 * Smart replies - Suggest 2–3 short responses
 */
async function getSmartReplies(message) {
  try {
    const prompt = `
      You are an AI that gives smart chat replies.
      User received: "${message}"
      Suggest 3 short and natural responses.
      Return ONLY a JSON array of strings. No markdown.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    let text = cleanAIResponse(response.text?.trim());

    try {
      return JSON.parse(text);
    } catch {
      return text
        .replace(/[\[\]"]/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } catch (error) {
    console.error("AI smart reply error:", error);
    return [];
  }
}

module.exports = { getPredictiveText, getSmartReplies };
