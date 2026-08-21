import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { v4 as uuid } from "uuid";
import { env } from "../config/env";
import { Media } from "../models/Media";
import { resolveUploadPath } from "../utils/path";

type SaveEventImageInput = {
  eventId: string;
  venueId: string;
  userId?: string;
  groupId?: string;
  conversationId?: string;
  kind: "profile" | "chat" | "group";
  fileBuffer: Buffer;
  mimeType: string;
};

export class LocalFileSystemStorageService {
  async saveEventImage(input: SaveEventImageInput) {
    const bucket =
      input.kind === "chat" && input.conversationId
        ? `venues/${input.venueId}/events/${input.eventId}/conversations/${input.conversationId}`
        : input.kind === "group" && input.groupId
          ? `venues/${input.venueId}/events/${input.eventId}/groups/${input.groupId}`
          : `venues/${input.venueId}/events/${input.eventId}/users/${input.userId}`;

    const filename = `${uuid()}.webp`;
    const relativeDirectory = path.posix.join("/", bucket);
    const relativePath = path.posix.join(relativeDirectory, filename);
    const absolutePath = resolveUploadPath(relativePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    const transformer = sharp(input.fileBuffer).rotate().resize(1440, 1440, {
      fit: "inside",
      withoutEnlargement: true
    });
    const metadata = await transformer.metadata();
    const output = await transformer.webp({ quality: 84 }).toBuffer();

    await fs.writeFile(absolutePath, output);

    return Media.create({
      eventId: input.eventId,
      venueId: input.venueId,
      userId: input.userId,
      groupId: input.groupId,
      conversationId: input.conversationId,
      kind: input.kind,
      mimeType: "image/webp",
      path: relativePath,
      width: metadata.width,
      height: metadata.height,
      sizeBytes: output.length
    });
  }

  async deleteMedia(mediaId: string) {
    const media = await Media.findById(mediaId);
    if (!media) return;

    await fs.rm(resolveUploadPath(media.path), { force: true });
    await media.deleteOne();
  }

  async deleteEventMedia(eventId: string) {
    const mediaItems = await Media.find({ eventId });

    await Promise.all(
      mediaItems.map(async (media) => {
        await fs.rm(resolveUploadPath(media.path), { force: true });
      })
    );

    const first = mediaItems[0];
    if (first) {
      const eventRoot = resolveUploadPath(`/venues/${first.venueId}/events/${eventId}`);
      await fs.rm(eventRoot, { recursive: true, force: true });
    }

    await Media.deleteMany({ eventId });
  }

  async assertWithinBudget() {
    const stats = await fs.statfs(env.UPLOAD_ROOT);
    const freeBytes = stats.bavail * stats.bsize;
    const requiredFreeBytes = env.MAX_EVENT_STORAGE_GB * 1024 * 1024 * 1024;

    if (freeBytes < requiredFreeBytes) {
      throw new Error("Upload storage threshold reached.");
    }
  }
}

export const mediaStorageService = new LocalFileSystemStorageService();

