import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { User } from "../models/User";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(8).max(24).optional(),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(40),
  dateOfBirth: z.string().date(),
  gender: z.enum(["woman", "man"])
}).superRefine((input, context) => {
  const birthDate = new Date(`${input.dateOfBirth}T00:00:00.000Z`);
  const adultThreshold = new Date();
  adultThreshold.setUTCFullYear(adultThreshold.getUTCFullYear() - 18);
  if (birthDate > adultThreshold) {
    context.addIssue({ code: "custom", path: ["dateOfBirth"], message: "You must be 18 or older to use ISKRA." });
  }
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128)
});

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/"
};

function publicUser(user: { _id: unknown; firstName: string; email?: string | null; phone?: string | null; dateOfBirth: Date; gender?: string | null }) {
  return {
    id: String(user._id),
    firstName: user.firstName,
    email: user.email || undefined,
    phone: user.phone || undefined,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender || undefined
  };
}

function setSession(res: Response, userId: string) {
  res.cookie("accessToken", signAccessToken(userId), cookieOptions);
  res.cookie("refreshToken", signRefreshToken(userId), { ...cookieOptions, maxAge: 30 * 24 * 60 * 60_000 });
}

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  if (await User.exists({ email: input.email })) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }
  const user = await User.create({
    ...input,
    phone: input.phone || undefined,
    dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
    passwordHash: await bcrypt.hash(input.password, 12)
  });
  setSession(res, String(user._id));
  res.status(201).json({ user: publicUser(user) });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!user?.passwordHash || !await bcrypt.compare(input.password, user.passwordHash)) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }
  setSession(res, String(user._id));
  res.json({ user: publicUser(user) });
}

export async function me(req: Request, res: Response) {
  const user = await User.findById(req.auth!.userId);
  if (!user) return res.status(401).json({ message: "Account no longer exists." });
  res.json({ user: publicUser(user) });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: "Session expired." });
  try {
    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "Session expired." });
    setSession(res, String(user._id));
    return res.json({ user: publicUser(user) });
  } catch {
    return res.status(401).json({ message: "Session expired." });
  }
}

export function logout(_req: Request, res: Response) {
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
  res.json({ ok: true });
}
