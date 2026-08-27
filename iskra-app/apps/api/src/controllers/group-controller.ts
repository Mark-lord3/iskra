import type { Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { Event } from "../models/Event";
import { Group } from "../models/Group";
import { requirePaidEventAccess } from "../lib/event-access";
import { requireDatingApp } from "../lib/feature-config";

const groupSchema = z.object({
  eventId: z.string().refine(Types.ObjectId.isValid, "Invalid event."),
  title: z.string().min(3),
  description: z.string().max(180).optional(),
  emoji: z.string().optional(),
  maxMembers: z.number().min(2).max(30).default(8),
  meetingArea: z.string().optional(),
  mode: z.enum(["open", "private"]).default("open")
});

export async function createGroup(req: Request, res: Response) {
  await requireDatingApp();
  const input = groupSchema.parse(req.body);
  const event = await Event.findOne({ _id: input.eventId, status: { $in: ["active", "ending"] }, endsAt: { $gt: new Date() } });

  if (!event) {
    return res.status(404).json({ message: "Event not found." });
  }
  await requirePaidEventAccess(req.auth!.userId, event._id);

  const group = await Group.create({
    ...input,
    venueId: event.venueId,
    expiresAt: event.cleanupAt
  });

  res.status(201).json(group);
}

export async function listGroups(req: Request, res: Response) {
  await requireDatingApp();
  const eventId = String(req.params.eventId || "");
  if (!Types.ObjectId.isValid(eventId)) return res.status(400).json({ message: "Invalid event." });
  await requirePaidEventAccess(req.auth!.userId, eventId);
  const groups = await Group.find({ eventId, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
  res.json(groups);
}
