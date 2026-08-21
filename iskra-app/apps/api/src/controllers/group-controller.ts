import type { Request, Response } from "express";
import { z } from "zod";
import { Event } from "../models/Event";
import { Group } from "../models/Group";

const groupSchema = z.object({
  eventId: z.string(),
  venueId: z.string(),
  title: z.string().min(3),
  description: z.string().max(180).optional(),
  emoji: z.string().optional(),
  maxMembers: z.number().min(2).max(30).default(8),
  meetingArea: z.string().optional(),
  mode: z.enum(["open", "private"]).default("open")
});

export async function createGroup(req: Request, res: Response) {
  const input = groupSchema.parse(req.body);
  const event = await Event.findById(input.eventId);

  if (!event) {
    return res.status(404).json({ message: "Event not found." });
  }

  const group = await Group.create({
    ...input,
    expiresAt: event.cleanupAt
  });

  res.status(201).json(group);
}

export async function listGroups(req: Request, res: Response) {
  const { eventId } = req.params;
  const groups = await Group.find({ eventId }).sort({ createdAt: -1 }).lean();
  res.json(groups);
}

