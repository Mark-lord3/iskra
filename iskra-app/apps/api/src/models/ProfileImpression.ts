import { Schema, model, Types } from "mongoose";

/**
 * Who has already been shown to whom, so the deck never repeats a face.
 * One row per pair per event, enforced by the index rather than by a check.
 */
const impressionSchema = new Schema(
  {
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true },
    seenUserId: { type: Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

impressionSchema.index({ eventId: 1, userId: 1, seenUserId: 1 }, { unique: true });

export const ProfileImpression = model("ProfileImpression", impressionSchema);
