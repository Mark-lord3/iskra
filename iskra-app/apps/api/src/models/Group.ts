import { Schema, model, Types } from "mongoose";

const groupSchema = new Schema(
  {
    eventId: { type: Types.ObjectId, ref: "Event", required: true },
    venueId: { type: Types.ObjectId, ref: "Venue", required: true },
    title: { type: String, required: true },
    description: { type: String },
    emoji: { type: String },
    maxMembers: { type: Number, default: 8 },
    meetingArea: { type: String },
    mode: { type: String, enum: ["open", "private"], default: "open" },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

export const Group = model("Group", groupSchema);

