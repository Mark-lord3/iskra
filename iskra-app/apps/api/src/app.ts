import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import type { NextFunction, Request, Response } from "express";
import { env } from "./config/env";
import { authRouter } from "./routes/auth-routes";
import { eventRouter } from "./routes/event-routes";
import { groupRouter } from "./routes/group-routes";
import { mediaRouter } from "./routes/media-routes";
import { profileRouter } from "./routes/profile-routes";
import { compassRouter } from "./routes/compass-routes";
import { accessRouter } from "./routes/access-routes";
import { competitionRouter } from "./routes/competition-routes";
import { configRouter } from "./routes/config-routes";
import { stripeAccessWebhook, stripeCheckoutConfigured, stripeWebhookConfigured } from "./controllers/access-controller";

export function createApp() {
  const app = express();
  const allowedLocalOrigins = new Set([
    env.CLIENT_ORIGIN,
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176"
  ]);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedLocalOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed by CORS."));
      },
      credentials: true
    })
  );
  app.post("/api/v1/access/webhook", express.raw({ type: "application/json" }), stripeAccessWebhook);
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/api/v1/health", (_req, res) => {
    res.json({
      ok: true,
      service: "iskra-api",
      integrations: {
        stripeCheckout: stripeCheckoutConfigured(),
        stripeWebhook: stripeWebhookConfigured()
      }
    });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/events", eventRouter);
  app.use("/api/v1/profiles", profileRouter);
  app.use("/api/v1/groups", groupRouter);
  app.use("/api/v1/media", mediaRouter);
  app.use("/api/v1/compass", compassRouter);
  app.use("/api/v1/config", configRouter);
  app.use("/api/v1/access", accessRouter);
  app.use("/api/v1/competition", competitionRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: "Route not found." });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || "Invalid request.", issues: error.issues });
    }
    if (error instanceof SyntaxError && "body" in error) {
      return res.status(400).json({ message: "Request body must be valid JSON." });
    }
    if (typeof error === "object" && error && "code" in error && error.code === 11000) {
      return res.status(409).json({ message: "That account or profile already exists." });
    }
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const explicitStatus = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : null;
    const status = explicitStatus || (message === "Origin not allowed by CORS." ? 403 : 500);
    if (status === 500) console.error("Unhandled API error", error);
    return res.status(status).json({ message: status === 500 ? "Unexpected server error." : message });
  });

  return app;
}
