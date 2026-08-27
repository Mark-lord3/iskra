import { Router } from "express";
import { foundMatch, getCompass, requestCompass, respondCompass, stopCompass, updateZone, wave } from "../controllers/compass-controller";
import { requireAuth } from "../middleware/auth";

export const compassRouter = Router();

compassRouter.use(requireAuth);
compassRouter.get("/:matchId", getCompass);
compassRouter.post("/:matchId/request", requestCompass);
compassRouter.post("/:matchId/respond", respondCompass);
compassRouter.post("/:matchId/zone", updateZone);
compassRouter.post("/:matchId/wave", wave);
compassRouter.post("/:matchId/found", foundMatch);
compassRouter.post("/:matchId/stop", stopCompass);
