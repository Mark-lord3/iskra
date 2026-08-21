import { Schema, model, Types } from "mongoose";

const mediaSchema = new Schema(
  {
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    venueId: { type: Types.ObjectId, ref: "Venue", required: true },
    userId: { type: Types.ObjectId, ref: "User" },
    groupId: { type: Types.ObjectId },
    conversationId: { type: Types.ObjectId },
    kind: {
      type: String,
      enum: ["profile", "chat", "group"],
      required: true
    },
    mimeType: { type: String, required: true },
    path: { type: String, required: true, unique: true },
    width: { type: Number },
    height: { type: Number },
    sizeBytes: { type: Number, required: true }
  },
  { timestamps: true }
);

export const Media = model("Media", mediaSchema);

