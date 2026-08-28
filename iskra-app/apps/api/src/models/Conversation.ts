import { Schema, model, Types } from "mongoose";

/**
 * A private thread between two matched guests.
 *
 * Conversations are event-scoped and expire with the event, like every other
 * artefact of a night. `pairKey` is the sorted user pair, so a unique index on
 * it guarantees one thread per pair per event however many times two people
 * match, unmatch and match again.
 */
const conversationSchema = new Schema(
  {
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    venueId: { type: Types.ObjectId, ref: "Venue", required: true },
    matchId: { type: Types.ObjectId, ref: "Match", required: true },
    pairKey: { type: String, required: true },
    participants: {
      type: [{ type: Types.ObjectId, ref: "User", required: true }],
      validate: [(v: unknown[]) => v.length === 2, "a conversation has exactly two participants"]
    },
    lastMessageAt: { type: Date, default: null, index: true },
    // A short preview so the list does not need to join every thread's messages.
    lastMessagePreview: { type: String, default: "" },
    lastMessageFrom: { type: Types.ObjectId, ref: "User", default: null },
    /* Unread is counted per participant rather than derived, so opening the
       list is one query no matter how long the history is. */
    unread: { type: Map, of: Number, default: {} },
    closedBy: [{ type: Types.ObjectId, ref: "User" }],
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

conversationSchema.index({ eventId: 1, pairKey: 1 }, { unique: true });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const Conversation = model("Conversation", conversationSchema);
