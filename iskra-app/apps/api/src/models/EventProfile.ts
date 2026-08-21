import { Schema, model, Types } from "mongoose";

const eventProfileSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    venueId: { type: Types.ObjectId, ref: "Venue", required: true },
    displayName: { type: String, required: true },
    bio: { type: String },
    intentions: [{ type: String }],
    photos: [{ type: String }],
    promptAnswer: { type: String },
    visibility: {
      type: String,
      enum: ["everyone", "matches", "messaged", "hidden"],
      default: "everyone"
    },
    mapVisibility: { type: Boolean, default: true },
    zone: { type: String },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

export const EventProfile = model("EventProfile", eventProfileSchema);

