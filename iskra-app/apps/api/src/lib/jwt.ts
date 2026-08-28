import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

const jwtIdentity = { issuer: "project-iskra-dating", audience: "project-iskra-web" };

export function signAccessToken(subject: string, version: number) {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"]
  };

  return jwt.sign({ sub: subject, ver: version }, env.JWT_ACCESS_SECRET, {
    ...options, ...jwtIdentity
  });
}

export function signRefreshToken(subject: string, version: number) {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"]
  };

  return jwt.sign({ sub: subject, ver: version }, env.JWT_REFRESH_SECRET, {
    ...options, ...jwtIdentity
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, jwtIdentity) as { sub: string; ver: number };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, jwtIdentity) as { sub: string; ver: number };
}
