import { Router } from "express";
import { listDiscoverProfiles, upsertEventProfile } from "../controllers/profile-controller";
import { requireAuth } from "../middleware/auth";

export const profileRouter = Router();

profileRouter.get("/discover/:eventId", requireAuth, listDiscoverProfiles);
profileRouter.post("/event", requireAuth, upsertEventProfile);

