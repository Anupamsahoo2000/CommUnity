// backend/config/socket.js
const { Server } = require("socket.io");

let io = null;

/**
 * Initialize Socket.io with an HTTP server.
 * Call this once from server.js
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*", // in prod: lock this to your frontend origin
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // Join event room for live seats updates / chat
    socket.on("join_event", (eventId) => {
      if (!eventId) return;
      const room = `event:${eventId}`;
      socket.join(room);
      console.log(`👥 Socket ${socket.id} joined room ${room}`);
    });

    socket.on("leave_event", (eventId) => {
      if (!eventId) return;
      const room = `event:${eventId}`;
      socket.leave(room);
      console.log(`👋 Socket ${socket.id} left room ${room}`);
    });

    // Basic placeholder for chat (Phase 4)
    socket.on("event_message", (payload) => {
      // payload: { eventId, text, userId, name }
      if (!payload?.eventId || !payload?.text) return;
      const room = `event:${payload.eventId}`;

      // TODO (Phase 4):
      //  - Save to Mongo ChatMessage
      //  - Attach timestamp, etc.

      io.to(room).emit("event_message", {
        ...payload,
        createdAt: new Date().toISOString(),
      });
    });

    socket.on("join_club_room", ({ clubId }) => {
      if (!clubId) return;
      const room = `club:${clubId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    });

    socket.on("leave_club_room", ({ clubId }) => {
      if (!clubId) return;
      const room = `club:${clubId}`;
      socket.leave(room);
      console.log(`Socket ${socket.id} left room ${room}`);
    });
    socket.on("club_message", (payload) => {
      // payload: { clubId, text, userId, name }
      if (!payload?.clubId || !payload?.text) return;
      const room = `club:${payload.clubId}`;

      // TODO (Phase 4):
      //  - Save to Mongo ClubChatMessage
      //  - Attach timestamp, etc.

      io.to(room).emit("club_message", {
        ...payload,
        createdAt: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
    });
  });

  console.log("✅ Socket.io initialized");
}

/**
 * Get the Socket.io instance anywhere in backend
 */
function getIo() {
  if (!io) {
    throw new Error(
      "Socket.io not initialized. Call initSocket(server) first."
    );
  }
  return io;
}

module.exports = {
  initSocket,
  getIo,
};
