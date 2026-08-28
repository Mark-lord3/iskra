import { env } from "../config/env";
import { Event } from "../models/Event";
import { EventCleanup } from "../models/EventCleanup";
import { EventProfile } from "../models/EventProfile";
import { Block } from "../models/Block";
import { Conversation } from "../models/Conversation";
import { Group } from "../models/Group";
import { GroupMember } from "../models/GroupMember";
import { GroupMessage } from "../models/GroupMessage";
import { Match } from "../models/Match";
import { Message } from "../models/Message";
import { ProfileImpression } from "../models/ProfileImpression";
import { ProfileSignal } from "../models/ProfileSignal";
import { mediaStorageService } from "./media-storage";

export async function runEventCleanupPass(now = new Date()) {
  const expiredEvents = await Event.find({
    cleanupAt: { $lte: now },
    status: { $in: ["active", "ending", "ended"] }
  });

  for (const event of expiredEvents) {
    const cleanupRecord = await EventCleanup.findOneAndUpdate(
      { eventId: event._id },
      { $inc: { attempts: 1 }, $set: { startedAt: now } },
      { new: true, upsert: true }
    );

    try {
      event.status = "ending";
      await event.save();

      await EventProfile.updateMany({ eventId: event._id }, { $set: { photos: [] } });
      await mediaStorageService.deleteEventMedia(String(event._id));
      await Promise.all([
        Message.deleteMany({ eventId: event._id }),
        Conversation.deleteMany({ eventId: event._id }),
        GroupMessage.deleteMany({ eventId: event._id }),
        GroupMember.deleteMany({ eventId: event._id }),
        Group.deleteMany({ eventId: event._id }),
        Match.deleteMany({ eventId: event._id }),
        ProfileSignal.deleteMany({ eventId: event._id }),
        ProfileImpression.deleteMany({ eventId: event._id }),
        Block.deleteMany({ eventId: event._id }),
        EventProfile.deleteMany({ eventId: event._id })
      ]);

      event.status = "cleaned";
      event.mediaCleanedAt = now;
      await event.save();

      cleanupRecord.completedAt = now;
      cleanupRecord.lastError = undefined;
      await cleanupRecord.save();
    } catch (error) {
      cleanupRecord.lastError = error instanceof Error ? error.message : "Unknown cleanup error";
      await cleanupRecord.save();
    }
  }
}

export function getCleanupAt(endsAt: Date) {
  return new Date(endsAt.getTime() + env.EVENT_MEDIA_RETENTION_MINUTES * 60_000);
}
