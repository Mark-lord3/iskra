import { Router } from "express";
import { castPartyVote, getCompetitionResults, getRandomCandidate } from "../controllers/competition-controller";
import { requireAuth } from "../middleware/auth";

export const competitionRouter = Router();
competitionRouter.get("/:eventId/candidate", requireAuth, getRandomCandidate);
competitionRouter.post("/:eventId/vote", requireAuth, castPartyVote);
competitionRouter.get("/:eventId/results", requireAuth, getCompetitionResults);
