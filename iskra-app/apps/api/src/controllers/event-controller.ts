import type { Request, Response } from "express";
import { z } from "zod";
import { Event } from "../models/Event";
import { Venue } from "../models/Venue";
import { getCleanupAt } from "../services/cleanup-service";

export async function listVenueLanding(req: Request, res: Response) {
  const { slug } = req.params;
  const event = await Event.findOne({ slug }).lean();

  if (!event) {
    return res.status(404).json({ message: "Event not found." });
  }

  const venue = await Venue.findById(event.venueId).lean();
  res.json({
    event,
    venue,
    avatars: []
  });
}

const createEventSchema = z.object({
  venueId: z.string(),
  slug: z.string().min(3),
  name: z.string().min(3),
  startsAt: z.string(),
  endsAt: z.string(),
  priceCents: z.number().default(500)
});

export async function createEvent(req: Request, res: Response) {
  const input = createEventSchema.parse(req.body);
  const endsAt = new Date(input.endsAt);

  const event = await Event.create({
    ...input,
    startsAt: new Date(input.startsAt),
    endsAt,
    cleanupAt: getCleanupAt(endsAt)
  });

  res.status(201).json(event);
}
