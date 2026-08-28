import fs from "node:fs/promises";
import type { NextFunction, Request, Response } from "express";
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

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_IMAGE_SIZE_MB * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const accepted = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
    /* Multer drops a rejected file silently, leaving req.file undefined - the
       same state as sending no file at all. Recording the reason here is what
       lets the handler below tell the two apart instead of telling someone who
       did pick a photo that no photo was provided. */
    if (!accepted) (req as Request & { rejectedUpload?: string }).rejectedUpload = file.mimetype;
    cb(null, accepted);
  }
});

/**
 * Turns multer's own failures into answers a person can act on.
 *
 * Without this an oversized photo reaches the generic error handler, which has
 * no status to work from and so reports a 500 "Unexpected server error." - the
 * one thing the uploader can neither understand nor fix.
 */
export function receiveUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          message: `That image is too large. Please use one under ${env.MAX_IMAGE_SIZE_MB}MB.`
        });
      }
      return res.status(400).json({ message: "That image could not be read. Please try another one." });
    }
    if (error) return next(error);
    return next();
  });
}

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
    const rejected = (req as Request & { rejectedUpload?: string }).rejectedUpload;
    if (rejected) {
      return res.status(415).json({ message: "That image format is not supported. Please use a JPEG, PNG or WebP photo." });
    }
    return res.status(400).json({ message: "Image file is required." });
  }

  if (!Types.ObjectId.isValid(input.eventId)) {
    return res.status(400).json({ message: "This event no longer accepts uploads." });
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
  await requireDatingApp();
  const mediaId = String(req.params.mediaId || "");
  if (!Types.ObjectId.isValid(mediaId)) {
    return res.status(404).json({ message: "Media not found." });
  }
  const media = await Media.findById(mediaId);

  if (!media) {
    return res.status(404).json({ message: "Media not found." });
  }

  const event = await Event.findById(media.eventId);
  if (!event || ["ended", "cleaned"].includes(event.status)) {
    return res.status(404).json({ message: "Media expired." });
  }
  await requirePaidEventAccess(req.auth!.userId, event._id);

  const file = await fs.readFile(resolveUploadPath(media.path));
  res.set("Cache-Control", "private, max-age=300");
  res.set("X-Content-Type-Options", "nosniff");
  res.contentType(media.mimeType).send(file);
}
