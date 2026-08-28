import { Router } from "express";
import { listVenueLanding } from "../controllers/event-controller";

export const eventRouter = Router();

eventRouter.get("/join/:slug", listVenueLanding);
