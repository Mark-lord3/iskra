import { Router } from "express";
import { serveMedia, upload, uploadEventImage } from "../controllers/media-controller";
import { requireAuth } from "../middleware/auth";

export const mediaRouter = Router();

mediaRouter.get("/:mediaId", requireAuth, serveMedia);
mediaRouter.post("/upload", requireAuth, upload.single("file"), uploadEventImage);

