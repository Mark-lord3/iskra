import { Router } from "express";
import { getPublicConfig } from "../controllers/config-controller";

export const configRouter = Router();
configRouter.get("/", getPublicConfig);
