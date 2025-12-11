// backend/services/chatService.js
const EventChatMessage = require("../models/mongo/eventChatMessage");

/**
 * Save a chat message for an event in MongoDB.
 */
async function saveEventMessage({
  eventId,
  senderId,
  senderName,
  text,
  isOrganizer,
}) {
  const msg = await EventChatMessage.create({
    eventId,
    senderId: senderId || null,
    senderName: senderName || "User",
    text,
    isOrganizer: !!isOrganizer,
  });
  return msg;
}

/**
 * List recent messages for an event (oldest → newest).
 */
async function listEventMessages(eventId, limit = 50) {
  const docs = await EventChatMessage.find({ eventId })
    .sort({ createdAt: -1 }) // newest first
    .limit(limit)
    .lean();

  // reverse so frontend gets oldest → newest
  return docs.reverse();
}

module.exports = {
  saveEventMessage,
  listEventMessages,
};
