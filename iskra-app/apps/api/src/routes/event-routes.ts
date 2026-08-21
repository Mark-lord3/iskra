import { Router } from "express";
import { createEvent, listVenueLanding } from "../controllers/event-controller";

export const eventRouter = Router();

eventRouter.get("/join/:slug", listVenueLanding);
eventRouter.post("/", createEvent);

