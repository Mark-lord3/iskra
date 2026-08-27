import { Schema, model, Types } from "mongoose";

const eventAccessPassSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
    venueId: { type: Types.ObjectId, ref: "Venue", required: true },
    status: { type: String, enum: ["pending", "paid", "refunded"], default: "pending" },
    amountCents: { type: Number, default: 500 },
    stripeCheckoutSessionId: { type: String, sparse: true, unique: true },
    paidAt: { type: Date },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

eventAccessPassSchema.index({ eventId: 1, userId: 1 }, { unique: true });
eventAccessPassSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EventAccessPass = model("EventAccessPass", eventAccessPassSchema);
