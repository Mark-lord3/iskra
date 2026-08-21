import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { authRouter } from "./routes/auth-routes";
import { eventRouter } from "./routes/event-routes";
import { groupRouter } from "./routes/group-routes";
import { mediaRouter } from "./routes/media-routes";
import { profileRouter } from "./routes/profile-routes";

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
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true, service: "iskra-api" });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/events", eventRouter);
  app.use("/api/v1/profiles", profileRouter);
  app.use("/api/v1/groups", groupRouter);
  app.use("/api/v1/media", mediaRouter);

  return app;
}
