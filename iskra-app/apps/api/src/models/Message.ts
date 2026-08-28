import { Schema, model, Types } from "mongoose";

/**
 * One message. `clientId` is supplied by the sender and unique per
 * conversation, so a retried send — a flaky connection, an impatient tap —
 * lands as the same message rather than a duplicate.
 */
const messageSchema = new Schema(
  {
    conversationId: { type: Types.ObjectId, ref: "Conversation", required: true, index: true },
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    senderId: { type: Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, maxlength: 2000 },
    clientId: { type: String, required: true },
    readAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

// Cursor pagination reads this index directly.
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, clientId: 1 }, { unique: true });

export const Message = model("Message", messageSchema);
