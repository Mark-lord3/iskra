import { Schema, model, Types } from "mongoose";

const profileSignalSchema = new Schema(
  {
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    venueId: { type: Types.ObjectId, ref: "Venue", required: true },
    fromUserId: { type: Types.ObjectId, ref: "User", required: true },
    toUserId: { type: Types.ObjectId, ref: "User", required: true },
    /* A wave is the like. A pass is recorded too, so the deck can skip
       people the guest has already declined without re-showing them. */
    kind: { type: String, enum: ["wave", "pass"], default: "wave" },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

/* One decision per pair, not one per pair-and-kind. A guest either waves or
   passes; undoing a pass updates that row to a wave rather than leaving both on
   record. Keying on `kind` as well would have let someone hold a wave and a
   pass for the same profile at once. */
profileSignalSchema.index({ eventId: 1, fromUserId: 1, toUserId: 1 }, { unique: true });
profileSignalSchema.index({ eventId: 1, toUserId: 1, kind: 1 });
profileSignalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ProfileSignal = model("ProfileSignal", profileSignalSchema);
