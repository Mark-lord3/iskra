import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    passwordHash: { type: String },
    firstName: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String },
    lookingFor: [{ type: String }],
    instagram: { type: String }
  },
  { timestamps: true }
);

export const User = model("User", userSchema);

