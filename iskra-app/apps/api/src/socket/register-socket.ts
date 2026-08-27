import type { Server } from "socket.io";
import { CompassSession } from "../models/CompassSession";
import { EventProfile } from "../models/EventProfile";
import { Match } from "../models/Match";
import { verifyAccessToken } from "../lib/jwt";

function cookieValue(header: string | undefined, key: string) {
  return header?.split(";").map((part) => part.trim().split("=")).find(([name]) => name === key)?.[1];
}

export function registerSocketHandlers(io: Server) {
  io.use((socket, next) => {
    const token = String(socket.handshake.auth?.token || cookieValue(socket.handshake.headers.cookie, "accessToken") || "");
    try {
      socket.data.userId = verifyAccessToken(token).sub;
      next();
    } catch {
      next(new Error("Authentication required."));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);

    socket.on("venue:join", async ({ eventId }) => {
      const checkedIn = await EventProfile.exists({ eventId, userId: socket.data.userId, expiresAt: { $gt: new Date() } });
      if (checkedIn) socket.join(`event:${eventId}`);
    });

    socket.on("compass:join", async ({ matchId }, acknowledge) => {
      const match = await Match.findOne({ _id: matchId, participants: socket.data.userId, status: "matched", expiresAt: { $gt: new Date() } }).lean();
      const session = match && await CompassSession.exists({ matchId, expiresAt: { $gt: new Date() } });
      if (!match || !session) {
        acknowledge?.({ ok: false });
        return;
      }
      socket.join(`match:${matchId}`);
      acknowledge?.({ ok: true });
    });
  });
}
