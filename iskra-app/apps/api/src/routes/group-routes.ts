import { Router } from "express";
import { createGroup, listGroups } from "../controllers/group-controller";
import { requireAuth } from "../middleware/auth";

export const groupRouter = Router();

groupRouter.get("/:eventId", requireAuth, listGroups);
groupRouter.post("/", requireAuth, createGroup);

