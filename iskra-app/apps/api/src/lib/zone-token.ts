import jwt from "jsonwebtoken";
import { env } from "../config/env";

type ZoneToken = { zoneId: string; venueId: string; version: number };

export function signZoneToken(payload: ZoneToken, expiresIn = "12h") {
  return jwt.sign(payload, env.ZONE_QR_SECRET, { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] });
}

export function verifyZoneToken(token: string) {
  return jwt.verify(token, env.ZONE_QR_SECRET) as ZoneToken;
}
