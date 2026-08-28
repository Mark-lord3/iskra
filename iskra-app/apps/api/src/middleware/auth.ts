import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { User } from "../models/User";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select("+authVersion").lean();
    if (!user || payload.ver !== (user.authVersion || 0)) {
      return res.status(401).json({ message: "Invalid session." });
    }
    req.auth = { userId: payload.sub };
    next();
  } catch {
    res.status(401).json({ message: "Invalid session." });
  }
}
