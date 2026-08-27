import { Router } from "express";
import { getMyEventProfile, listDiscoverProfiles, upsertEventProfile, waveAtProfile } from "../controllers/profile-controller";
import { requireAuth } from "../middleware/auth";

export const profileRouter = Router();

profileRouter.get("/discover/:eventId", requireAuth, listDiscoverProfiles);
profileRouter.get("/event/:eventId/me", requireAuth, getMyEventProfile);
profileRouter.post("/event", requireAuth, upsertEventProfile);
profileRouter.post("/:profileId/wave", requireAuth, waveAtProfile);
