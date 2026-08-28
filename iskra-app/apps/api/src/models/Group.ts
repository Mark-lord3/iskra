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
    category: {
      type: String,
      enum: ["dancing", "drinks", "networking", "new-friends", "hangout"],
      default: "hangout",
      index: true
    },
    hostId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    /* Denormalised so a list of groups does not need a count query per row.
       GroupMember remains the source of truth; this is kept in step with it. */
    memberCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["open", "full", "closed"], default: "open" },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

export const Group = model("Group", groupSchema);

