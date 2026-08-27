import { Types } from "mongoose";
import { EventAccessPass } from "../models/EventAccessPass";

export async function hasPaidEventAccess(userId: string, eventId: string | Types.ObjectId) {
  return Boolean(await EventAccessPass.exists({ userId, eventId, status: "paid", expiresAt: { $gt: new Date() } }));
}

export async function requirePaidEventAccess(userId: string, eventId: string | Types.ObjectId) {
  if (!await hasPaidEventAccess(userId, eventId)) {
    throw Object.assign(new Error("A $5 event pass is required to enter this room."), { status: 402 });
  }
}
