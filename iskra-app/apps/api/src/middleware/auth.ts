import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub };
    next();
  } catch {
    res.status(401).json({ message: "Invalid session." });
  }
}

