import { Schema, model } from "mongoose";

const venueSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    logoUrl: { type: String },
    heroImageUrl: { type: String },
    description: { type: String },
    locationLabel: { type: String },
    defaultPriceCents: { type: Number, default: 500 },
    zones: [{ type: String }]
  },
  { timestamps: true }
);

export const Venue = model("Venue", venueSchema);

