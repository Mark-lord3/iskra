import type { Server } from "socket.io";

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket) => {
    socket.on("venue:join", ({ eventId }) => {
      socket.join(`event:${eventId}`);
    });

    socket.on("chat:typing", ({ conversationId, userId }) => {
      socket.to(`conversation:${conversationId}`).emit("chat:typing", { conversationId, userId });
    });

    socket.on("chat:join", ({ conversationId }) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("chat:message", (payload) => {
      io.to(`conversation:${payload.conversationId}`).emit("chat:message", payload);
    });
  });
}

