import { Schema, model, Types } from "mongoose";

const eventSchema = new Schema(
  {
    venueId: { type: Types.ObjectId, ref: "Venue", required: true },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    cleanupAt: { type: Date, required: true },
    priceCents: { type: Number, default: 500 },
    status: {
      type: String,
      enum: ["draft", "active", "ending", "ended", "cleaned"],
      default: "active"
    },
    participantCount: { type: Number, default: 0 },
    mediaCleanedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export const Event = model("Event", eventSchema);

