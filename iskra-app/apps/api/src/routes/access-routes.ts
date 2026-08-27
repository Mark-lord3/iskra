import { Router } from "express";
import { completeAccessCheckout, createAccessCheckout, getAccessStatus } from "../controllers/access-controller";
import { requireAuth } from "../middleware/auth";

export const accessRouter = Router();
accessRouter.get("/:eventId/status", requireAuth, getAccessStatus);
accessRouter.post("/:eventId/checkout", requireAuth, createAccessCheckout);
accessRouter.post("/complete", requireAuth, completeAccessCheckout);
