import { Schema, model, Types } from "mongoose";

/**
 * Group membership as its own document rather than an array on the group.
 *
 * The unique index is what makes capacity safe: a join is an insert, so two
 * simultaneous requests for the last seat cannot both succeed, and the count
 * never has to be read-then-written.
 */
const groupMemberSchema = new Schema(
  {
    groupId: { type: Types.ObjectId, ref: "Group", required: true, index: true },
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["host", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });

export const GroupMember = model("GroupMember", groupMemberSchema);
