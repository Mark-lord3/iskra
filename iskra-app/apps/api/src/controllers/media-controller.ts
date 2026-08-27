import fs from "node:fs/promises";
import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../config/env";
import { Event } from "../models/Event";
import { Media } from "../models/Media";
import { mediaStorageService } from "../services/media-storage";
import { resolveUploadPath } from "../utils/path";
import { Types } from "mongoose";
import { requirePaidEventAccess } from "../lib/event-access";
import { requireDatingApp } from "../lib/feature-config";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_IMAGE_SIZE_MB * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    cb(null, allowed.includes(file.mimetype));
  }
});

const uploadSchema = z.object({
  eventId: z.string(),
  venueId: z.string(),
  kind: z.enum(["profile", "chat", "group"]),
  conversationId: z.string().optional(),
  groupId: z.string().optional()
});

export async function uploadEventImage(req: Request, res: Response) {
  await requireDatingApp();
  const file = req.file;
  const input = uploadSchema.parse(req.body);

  if (!file) {
    return res.status(400).json({ message: "Image file is required." });
  }

  const event = await Event.findById(input.eventId);
  if (!event || ["ending", "ended", "cleaned"].includes(event.status)) {
    return res.status(400).json({ message: "This event no longer accepts uploads." });
  }
  if (!Types.ObjectId.isValid(input.venueId) || String(event.venueId) !== input.venueId) {
    return res.status(400).json({ message: "Venue does not match this event." });
  }
  await requirePaidEventAccess(req.auth!.userId, event._id);

  await mediaStorageService.assertWithinBudget();

  const media = await mediaStorageService.saveEventImage({
    eventId: input.eventId,
    venueId: input.venueId,
    userId: req.auth?.userId,
    groupId: input.groupId,
    conversationId: input.conversationId,
    kind: input.kind,
    fileBuffer: file.buffer,
    mimeType: file.mimetype
  });

  res.status(201).json({ ...media.toObject(), url: `${req.protocol}://${req.get("host")}/api/v1/media/${media._id}` });
}

export async function serveMedia(req: Request, res: Response) {
  const { mediaId } = req.params;
  const media = await Media.findById(mediaId);

  if (!media) {
    return res.status(404).json({ message: "Media not found." });
  }

  const event = await Event.findById(media.eventId);
  if (!event || ["ended", "cleaned"].includes(event.status)) {
    return res.status(404).json({ message: "Media expired." });
  }

  const file = await fs.readFile(resolveUploadPath(media.path));
  res.contentType(media.mimeType).send(file);
}
