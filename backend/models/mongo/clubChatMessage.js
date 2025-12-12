const mongoose = require("mongoose");

const clubChatMessageSchema = new mongoose.Schema(
  {
    clubId: {
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
    isAdminOrOwner: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model("ClubChatMessage", clubChatMessageSchema);
