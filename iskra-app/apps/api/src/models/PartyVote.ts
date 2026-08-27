import { Schema, model, Types } from "mongoose";

const partyVoteSchema = new Schema(
  {
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    voterUserId: { type: Types.ObjectId, ref: "User", required: true },
    candidateProfileId: { type: Types.ObjectId, ref: "EventProfile", required: true },
    candidateUserId: { type: Types.ObjectId, ref: "User", required: true },
    candidateGender: { type: String, enum: ["woman", "man"], required: true },
    direction: { type: String, enum: ["left", "right"], required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

partyVoteSchema.index({ eventId: 1, voterUserId: 1, candidateProfileId: 1 }, { unique: true });
partyVoteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PartyVote = model("PartyVote", partyVoteSchema);
