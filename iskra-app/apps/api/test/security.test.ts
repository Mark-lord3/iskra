import assert from "node:assert/strict";
import test from "node:test";
import { envSchema } from "../src/config/env";

const strongProduction = {
  NODE_ENV: "production",
  CLIENT_ORIGIN: "https://dating.project-iskra.com",
  PROMO_API_URL: "http://iskra-production:4310/api",
  MONGODB_URI: "mongodb+srv://example.invalid/iskra_dating_production",
  JWT_ACCESS_SECRET: "a".repeat(64),
  JWT_REFRESH_SECRET: "r".repeat(64),
  ZONE_QR_SECRET: "z".repeat(64)
};

test("production accepts isolated secrets and a private promo service", () => {
  assert.equal(envSchema.safeParse(strongProduction).success, true);
});

test("production rejects development and reused secrets", () => {
  assert.equal(envSchema.safeParse({
    ...strongProduction,
    JWT_ACCESS_SECRET: "local-development-access-secret"
  }).success, false);
  assert.equal(envSchema.safeParse({
    ...strongProduction,
    JWT_REFRESH_SECRET: strongProduction.JWT_ACCESS_SECRET
  }).success, false);
});

test("production rejects insecure public origins and local databases", () => {
  assert.equal(envSchema.safeParse({ ...strongProduction, CLIENT_ORIGIN: "http://dating.project-iskra.com" }).success, false);
  assert.equal(envSchema.safeParse({ ...strongProduction, PROMO_API_URL: "http://promo.example.com/api" }).success, false);
  assert.equal(envSchema.safeParse({ ...strongProduction, MONGODB_URI: "mongodb://localhost:27017/iskra" }).success, false);
});
