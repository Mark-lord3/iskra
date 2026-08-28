import { Router } from "express";
import { createGroup, getGroup, joinGroup, leaveGroup, listGroupMessages, listGroups, reportGroup, sendGroupMessage } from "../controllers/group-controller";
import { requireAuth } from "../middleware/auth";

export const groupRouter = Router();

groupRouter.get("/:eventId", requireAuth, listGroups);
groupRouter.post("/", requireAuth, createGroup);
groupRouter.get("/detail/:groupId", requireAuth, getGroup);
groupRouter.post("/:groupId/join", requireAuth, joinGroup);
groupRouter.delete("/:groupId/join", requireAuth, leaveGroup);
groupRouter.get("/:groupId/messages", requireAuth, listGroupMessages);
groupRouter.post("/:groupId/messages", requireAuth, sendGroupMessage);
groupRouter.post("/:groupId/report", requireAuth, reportGroup);
