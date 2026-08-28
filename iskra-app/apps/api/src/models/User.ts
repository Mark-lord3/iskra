import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, select: false },
    firstName: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ["woman", "man"], required: true },
    lookingFor: [{ type: String }],
    instagram: { type: String },
    authVersion: { type: Number, default: 0, min: 0, select: false }
  },
  { timestamps: true }
);

export const User = model("User", userSchema);
