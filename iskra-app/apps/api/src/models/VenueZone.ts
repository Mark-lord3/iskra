import { Schema, model, Types } from "mongoose";

const venueZoneSchema = new Schema(
  {
    venueId: { type: Types.ObjectId, ref: "Venue", required: true, index: true },
    slug: { type: String, required: true },
    name: { type: String, required: true },
    floor: { type: Number, default: 0 },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    active: { type: Boolean, default: true },
    visible: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 1 },
    freshnessSeconds: { type: Number, default: 120, min: 30, max: 600 }
  },
  { timestamps: true }
);

venueZoneSchema.index({ venueId: 1, slug: 1 }, { unique: true });

export const VenueZone = model("VenueZone", venueZoneSchema);
