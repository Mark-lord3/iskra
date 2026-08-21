import { Schema, model, Types } from "mongoose";

const eventCleanupSchema = new Schema(
  {
    eventId: { type: Types.ObjectId, ref: "Event", required: true, unique: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    attempts: { type: Number, default: 0 },
    lastError: { type: String }
  },
  { timestamps: true }
);

export const EventCleanup = model("EventCleanup", eventCleanupSchema);

