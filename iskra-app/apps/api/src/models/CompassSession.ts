import { Schema, model, Types } from "mongoose";

const compassSessionSchema = new Schema(
  {
    matchId: { type: Types.ObjectId, ref: "Match", required: true, unique: true },
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    venueId: { type: Types.ObjectId, ref: "Venue", required: true },
    participantA: { type: Types.ObjectId, ref: "User", required: true },
    participantB: { type: Types.ObjectId, ref: "User", required: true },
    requestedBy: { type: Types.ObjectId, ref: "User", required: true },
    acceptedBy: [{ type: Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["requested", "active", "declined", "found", "stopped"],
      default: "requested"
    },
    participantAZoneId: { type: Types.ObjectId, ref: "VenueZone", default: null },
    participantBZoneId: { type: Types.ObjectId, ref: "VenueZone", default: null },
    participantAZoneUpdatedAt: { type: Date, default: null },
    participantBZoneUpdatedAt: { type: Date, default: null },
    participantALastWaveAt: { type: Date, default: null },
    participantBLastWaveAt: { type: Date, default: null },
    foundBy: [{ type: Types.ObjectId, ref: "User" }],
    stoppedBy: { type: Types.ObjectId, ref: "User", default: null },
    pattern: { type: String, enum: ["ember", "plasma", "signal"], required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

compassSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CompassSession = model("CompassSession", compassSessionSchema);
