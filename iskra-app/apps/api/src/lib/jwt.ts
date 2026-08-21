import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export function signAccessToken(subject: string) {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"]
  };

  return jwt.sign({ sub: subject }, env.JWT_ACCESS_SECRET, {
    ...options
  });
}

export function signRefreshToken(subject: string) {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"]
  };

  return jwt.sign({ sub: subject }, env.JWT_REFRESH_SECRET, {
    ...options
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
}
