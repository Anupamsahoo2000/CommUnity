const mongoose = require("mongoose");

const eventChatMessageSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      default: null,
    },
    senderName: {
      type: String,
      default: "User",
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    isOrganizer: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model("EventChatMessage", eventChatMessageSchema);
