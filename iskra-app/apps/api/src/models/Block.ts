import { Schema, model, Types } from "mongoose";

/**
 * A block. Enforced in both directions: neither person may discover, wave at
 * or message the other, regardless of who blocked whom.
 */
const blockSchema = new Schema(
  {
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    blockerId: { type: Types.ObjectId, ref: "User", required: true },
    blockedId: { type: Types.ObjectId, ref: "User", required: true },
    reason: { type: String, default: "" },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

blockSchema.index({ eventId: 1, blockerId: 1, blockedId: 1 }, { unique: true });
// The discovery filter looks both ways from a single index.
blockSchema.index({ eventId: 1, blockedId: 1 });

export const Block = model("Block", blockSchema);
