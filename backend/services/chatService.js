// backend/services/chatService.js
const EventChatMessage = require("../models/mongo/eventChatMessage");
const ClubChatMessage = require("../models/mongo/clubChatMessage");

/* ---------- EVENT CHAT ---------- */

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

async function listEventMessages(eventId, limit = 50) {
  const docs = await EventChatMessage.find({ eventId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return docs.reverse();
}

/* ---------- CLUB CHAT ---------- */

async function saveClubMessage({
  clubId,
  senderId,
  senderName,
  text,
  isAdminOrOwner,
}) {
  const msg = await ClubChatMessage.create({
    clubId,
    senderId: senderId || null,
    senderName: senderName || "User",
    text,
    isAdminOrOwner: !!isAdminOrOwner,
  });
  return msg;
}

async function listClubMessages(clubId, limit = 50) {
  const docs = await ClubChatMessage.find({ clubId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return docs.reverse();
}

module.exports = {
  // event
  saveEventMessage,
  listEventMessages,
  // club
  saveClubMessage,
  listClubMessages,
};
