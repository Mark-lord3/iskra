import { Schema, model, Types } from "mongoose";

const matchSchema = new Schema(
  {
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    venueId: { type: Types.ObjectId, ref: "Venue", required: true, index: true },
    pairKey: { type: String, index: true },
    participants: {
      type: [{ type: Types.ObjectId, ref: "User" }],
      required: true,
      validate: [(value: Types.ObjectId[]) => value.length === 2, "A match requires two people."]
    },
    status: {
      type: String,
      enum: ["matched", "unmatched", "blocked", "expired"],
      default: "matched"
    },
    matchedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

matchSchema.index({ participants: 1, eventId: 1 });
matchSchema.index({ eventId: 1, pairKey: 1 }, { unique: true, sparse: true });
matchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Match = model("Match", matchSchema);
