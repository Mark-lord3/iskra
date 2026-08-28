import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isTrustedOrigin(origin: string | undefined) {
  if (!origin) return env.NODE_ENV !== "production";
  try {
    return new URL(origin).origin === new URL(env.CLIENT_ORIGIN).origin;
  } catch {
    return false;
  }
}

export function requireTrustedBrowserOrigin(req: Request, res: Response, next: NextFunction) {
  if (!unsafeMethods.has(req.method) || req.path === "/api/v1/access/webhook") return next();

  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return res.status(403).json({ message: "Cross-site request blocked." });
  }

  const origin = req.get("origin");
  if (origin && !isTrustedOrigin(origin)) {
    return res.status(403).json({ message: "Request origin is not allowed." });
  }
  if (!origin && env.NODE_ENV === "production" && fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return res.status(403).json({ message: "Request origin could not be verified." });
  }
  return next();
}
