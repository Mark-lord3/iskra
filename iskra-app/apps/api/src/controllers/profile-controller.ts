import type { Request, Response } from "express";
import { z } from "zod";
import { Event } from "../models/Event";
import { EventProfile } from "../models/EventProfile";

const profileSchema = z.object({
  eventId: z.string(),
  venueId: z.string(),
  displayName: z.string().min(1),
  bio: z.string().max(280).optional(),
  intentions: z.array(z.string()).min(1),
  promptAnswer: z.string().max(140).optional(),
  zone: z.string().optional()
});

export async function upsertEventProfile(req: Request, res: Response) {
  const input = profileSchema.parse(req.body);
  const event = await Event.findById(input.eventId);

  if (!event) {
    return res.status(404).json({ message: "Event not found." });
  }

  const profile = await EventProfile.findOneAndUpdate(
    { eventId: input.eventId, userId: req.auth?.userId },
    {
      ...input,
      userId: req.auth?.userId,
      expiresAt: event.cleanupAt
    },
    { new: true, upsert: true }
  );

  res.json(profile);
}

export async function listDiscoverProfiles(req: Request, res: Response) {
  const { eventId } = req.params;
  const profiles = await EventProfile.find({ eventId }).sort({ updatedAt: -1 }).limit(100).lean();
  res.json(profiles);
}

