import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { z } from "zod";
import { signAccessToken, signRefreshToken } from "../lib/jwt";
import { User } from "../models/User";

const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  dateOfBirth: z.string(),
  gender: z.string().optional()
});

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await User.create({
    ...input,
    dateOfBirth: new Date(input.dateOfBirth),
    passwordHash
  });

  const accessToken = signAccessToken(String(user._id));
  const refreshToken = signRefreshToken(String(user._id));

  res.cookie("accessToken", accessToken, { httpOnly: true, sameSite: "lax" });
  res.cookie("refreshToken", refreshToken, { httpOnly: true, sameSite: "lax" });

  res.status(201).json({
    user: {
      id: user._id,
      firstName: user.firstName,
      email: user.email,
      phone: user.phone
    },
    accessToken,
    refreshToken
  });
}

