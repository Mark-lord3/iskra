import type { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { Event } from "../models/Event";
import { EventProfile } from "../models/EventProfile";
import { User } from "../models/User";
import { ProfileSignal } from "../models/ProfileSignal";
import { Match } from "../models/Match";
import { requirePaidEventAccess } from "../lib/event-access";
import { requireDatingApp } from "../lib/feature-config";
import { Media } from "../models/Media";

function mediaIdFromUrl(value: string) {
  try {
    const pathname = new URL(value, "https://dating.project-iskra.com").pathname;
    return pathname.match(/^\/api\/v1\/media\/([a-f\d]{24})$/i)?.[1] || null;
  } catch {
    return null;
  }
}

const profileSchema = z.object({
  eventId: z.string().refine(Types.ObjectId.isValid, "Invalid event."),
  displayName: z.string().trim().min(1).max(40),
  bio: z.string().trim().max(280).optional(),
  intentions: z.array(z.enum(["Dating", "New friends", "Drinks", "Dancing", "Group hangout", "Networking"])).min(1).max(4),
  promptAnswer: z.string().trim().max(140).optional(),
  zone: z.string().trim().max(60).optional(),
  photos: z.array(z.string().trim().max(512).refine((value) => Boolean(mediaIdFromUrl(value)), "Use an uploaded ISKRA image.")).max(6).optional(),
  competitionConsent: z.boolean().optional()
});

function ageFrom(dateOfBirth: Date) {
  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const birthdayPassed = today.getUTCMonth() > dateOfBirth.getUTCMonth()
    || (today.getUTCMonth() === dateOfBirth.getUTCMonth() && today.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

export async function upsertEventProfile(req: Request, res: Response) {
  await requireDatingApp();
  const input = profileSchema.parse(req.body);
  const event = await Event.findOne({
    _id: input.eventId,
    status: { $in: ["active", "ending"] },
    endsAt: { $gt: new Date() }
  });
  if (!event) return res.status(409).json({ message: "This venue session is not active." });
  await requirePaidEventAccess(req.auth!.userId, event._id);
  const photoIds = (input.photos || []).map(mediaIdFromUrl).filter((id): id is string => Boolean(id));
  if (photoIds.length) {
    const ownedPhotos = await Media.countDocuments({
      _id: { $in: photoIds }, eventId: event._id, userId: req.auth!.userId, kind: "profile"
    });
    if (ownedPhotos !== new Set(photoIds).size) {
      return res.status(400).json({ message: "One or more profile photos are not owned by this account." });
    }
  }
  const existed = await EventProfile.exists({ eventId: event._id, userId: req.auth!.userId });

  const competitionEligible = Boolean(input.competitionConsent && input.photos?.length);
  const profile = await EventProfile.findOneAndUpdate(
    { eventId: event._id, userId: req.auth!.userId },
    {
      ...input,
      ...(input.photos ? { photos: photoIds.map((id) => `/api/v1/media/${id}`) } : {}),
      venueId: event.venueId,
      userId: req.auth!.userId,
      visibility: "everyone",
      competitionEligible,
      competitionConsentAt: competitionEligible ? new Date() : undefined,
      expiresAt: event.cleanupAt
    },
    { new: true, upsert: true, runValidators: true }
  );
  if (!existed) await Event.updateOne({ _id: event._id }, { $inc: { participantCount: 1 } });
  res.json(profile);
}

export async function getMyEventProfile(req: Request, res: Response) {
  await requireDatingApp();
  const eventId = String(req.params.eventId || "");
  if (!Types.ObjectId.isValid(eventId)) return res.status(400).json({ message: "Invalid event." });
  await requirePaidEventAccess(req.auth!.userId, eventId);
  const [profile, user] = await Promise.all([
    EventProfile.findOne({ eventId, userId: req.auth!.userId, expiresAt: { $gt: new Date() } }).lean(),
    User.findById(req.auth!.userId).select("dateOfBirth gender").lean()
  ]);
  res.json({
    profile: profile ? {
      ...profile,
      age: user?.dateOfBirth ? ageFrom(user.dateOfBirth) : null,
      gender: user?.gender || null
    } : null
  });
}

export async function listDiscoverProfiles(req: Request, res: Response) {
  await requireDatingApp();
  const eventId = String(req.params.eventId || "");
  if (!Types.ObjectId.isValid(eventId)) return res.status(400).json({ message: "Invalid event." });
  await requirePaidEventAccess(req.auth!.userId, eventId);
  const profiles = await EventProfile.find({
    eventId,
    userId: { $ne: req.auth!.userId },
    visibility: "everyone",
    expiresAt: { $gt: new Date() }
  }).sort({ updatedAt: -1 }).limit(100).lean();
  const users = await User.find({ _id: { $in: profiles.map((profile) => profile.userId) } }).select("dateOfBirth").lean();
  const userMap = new Map(users.map((user) => [String(user._id), user]));
  res.json(profiles.map((profile) => {
    const user = userMap.get(String(profile.userId));
    return {
      id: String(profile._id),
      userId: String(profile.userId),
      name: profile.displayName,
      age: user?.dateOfBirth ? ageFrom(user.dateOfBirth) : null,
      zone: profile.zone || "Around the venue",
      status: profile.intentions[0] || "Meeting people",
      intentions: profile.intentions,
      bio: profile.bio || profile.promptAnswer || "Here for the ISKRA energy.",
      image: profile.photos[0] || null
    };
  }));
}

export async function waveAtProfile(req: Request, res: Response) {
  await requireDatingApp();
  const profileId = String(req.params.profileId || "");
  if (!Types.ObjectId.isValid(profileId)) return res.status(404).json({ message: "Profile not found." });
  const target = await EventProfile.findOne({
    _id: profileId,
    userId: { $ne: req.auth!.userId },
    visibility: "everyone",
    expiresAt: { $gt: new Date() }
  });
  if (!target) return res.status(404).json({ message: "Profile not found." });
  await requirePaidEventAccess(req.auth!.userId, String(target.eventId));
  const event = await Event.findOne({ _id: target.eventId, status: { $in: ["active", "ending"] }, endsAt: { $gt: new Date() } });
  if (!event) return res.status(409).json({ message: "This venue session has ended." });

  await ProfileSignal.findOneAndUpdate(
    { eventId: target.eventId, fromUserId: req.auth!.userId, toUserId: target.userId, kind: "wave" },
    { venueId: target.venueId, expiresAt: event.cleanupAt },
    { upsert: true, new: true }
  );
  const reciprocal = await ProfileSignal.exists({
    eventId: target.eventId,
    fromUserId: target.userId,
    toUserId: req.auth!.userId,
    kind: "wave",
    expiresAt: { $gt: new Date() }
  });
  if (!reciprocal) {
    req.app.get("io")?.to(`user:${String(target.userId)}`).emit("profile:wave", { eventId: String(target.eventId) });
    return res.status(201).json({ matched: false, message: "Wave sent privately." });
  }

  const participants = [String(req.auth!.userId), String(target.userId)].sort();
  const match = await Match.findOneAndUpdate(
    { eventId: target.eventId, pairKey: participants.join(":") },
    {
      eventId: target.eventId,
      venueId: target.venueId,
      pairKey: participants.join(":"),
      participants,
      status: "matched",
      matchedAt: new Date(),
      expiresAt: event.cleanupAt
    },
    { upsert: true, new: true }
  );
  participants.forEach((userId) => req.app.get("io")?.to(`user:${userId}`).emit("match:created", { matchId: String(match._id) }));
  return res.status(201).json({ matched: true, matchId: String(match._id), message: "It is a match." });
}
