import { Schema, model, Types } from "mongoose";

const profileSignalSchema = new Schema(
  {
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    venueId: { type: Types.ObjectId, ref: "Venue", required: true },
    fromUserId: { type: Types.ObjectId, ref: "User", required: true },
    toUserId: { type: Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["wave"], default: "wave" },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

profileSignalSchema.index({ eventId: 1, fromUserId: 1, toUserId: 1, kind: 1 }, { unique: true });
profileSignalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ProfileSignal = model("ProfileSignal", profileSignalSchema);
