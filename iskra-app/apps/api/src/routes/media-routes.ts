import { Router } from "express";
import { receiveUpload, serveMedia, uploadEventImage } from "../controllers/media-controller";
import { requireAuth } from "../middleware/auth";

export const mediaRouter = Router();

mediaRouter.get("/:mediaId", requireAuth, serveMedia);
mediaRouter.post("/upload", requireAuth, receiveUpload, uploadEventImage);

