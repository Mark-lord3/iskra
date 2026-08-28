import type { Server } from "socket.io";
import { CompassSession } from "../models/CompassSession";
import { EventProfile } from "../models/EventProfile";
import { Match } from "../models/Match";
import { verifyAccessToken } from "../lib/jwt";
import { User } from "../models/User";
import { z } from "zod";

const idPayload = z.object({ eventId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
const matchPayload = z.object({ matchId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();

function cookieValue(header: string | undefined, key: string) {
  return header?.split(";").map((part) => part.trim().split("=")).find(([name]) => name === key)?.[1];
}

export function registerSocketHandlers(io: Server) {
  io.use(async (socket, next) => {
    const token = String(socket.handshake.auth?.token || cookieValue(socket.handshake.headers.cookie, "accessToken") || "");
    try {
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select("+authVersion").lean();
      if (!user || payload.ver !== (user.authVersion || 0)) throw new Error("Invalid session.");
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Authentication required."));
    }
  });

  io.on("connection", (socket) => {
    let packetCount = 0;
    let windowStartedAt = Date.now();
    socket.use((_packet, next) => {
      const now = Date.now();
      if (now - windowStartedAt >= 10_000) {
        packetCount = 0;
        windowStartedAt = now;
      }
      packetCount += 1;
      if (packetCount > 60) return next(new Error("Socket rate limit exceeded."));
      return next();
    });
    socket.join(`user:${socket.data.userId}`);

    socket.on("venue:join", async (payload) => {
      const parsed = idPayload.safeParse(payload);
      if (!parsed.success) return;
      const { eventId } = parsed.data;
      const checkedIn = await EventProfile.exists({ eventId, userId: socket.data.userId, expiresAt: { $gt: new Date() } });
      if (checkedIn) socket.join(`event:${eventId}`);
    });

    socket.on("compass:join", async (payload, acknowledge) => {
      const parsed = matchPayload.safeParse(payload);
      if (!parsed.success) {
        acknowledge?.({ ok: false });
        return;
      }
      const { matchId } = parsed.data;
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
