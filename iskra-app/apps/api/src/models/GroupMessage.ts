import { Schema, model, Types } from "mongoose";

const groupMessageSchema = new Schema({
  groupId: { type: Types.ObjectId, ref: "Group", required: true, index: true },
  eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
  senderId: { type: Types.ObjectId, ref: "User", required: true },
  body: { type: String, required: true, maxlength: 1000 },
  clientId: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true }
}, { timestamps: true });

groupMessageSchema.index({ groupId: 1, createdAt: -1 });
groupMessageSchema.index({ groupId: 1, clientId: 1 }, { unique: true });

export const GroupMessage = model("GroupMessage", groupMessageSchema);
