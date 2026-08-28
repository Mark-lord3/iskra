import crypto from "node:crypto";
import fs from "node:fs";

const [basePath, promoPath, existingPath, outputPath] = process.argv.slice(2);
if (!basePath || !promoPath || !outputPath) {
  throw new Error("Usage: build-production-env.mjs <dating-env> <promo-env> <existing-env-or-empty> <output>");
}

function readEnv(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, "utf8").split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return [];
    const separator = trimmed.indexOf("=");
    if (separator < 1) return [];
    return [[trimmed.slice(0, separator), trimmed.slice(separator + 1)]];
  }));
}

function required(value, message) {
  if (!value) throw new Error(message);
  return value;
}

function stableSecret(existing, key) {
  return existing[key]?.length >= 32 ? existing[key] : crypto.randomBytes(48).toString("base64url");
}

const base = readEnv(basePath);
const promo = readEnv(promoPath);
const existing = readEnv(existingPath);
const mongo = new URL(required(base.MONGODB_URI_live || base.MONGODB_URI, `${basePath} has no dating MongoDB URI.`));
mongo.pathname = "/iskra_dating_production";
mongo.searchParams.set("appName", "IskraDatingProduction");

const stripeSecret = promo.STRIPE_SECRET_KEY_live || promo.STRIPE_SECRET_KEY;
if (!stripeSecret?.startsWith("sk_live_")) {
  throw new Error(`${promoPath} must contain a live Stripe secret key.`);
}
const datingWebhook = promo.STRIPE_DATING_WEBHOOK_SECRET_live || existing.STRIPE_WEBHOOK_SECRET || "";

const runtime = {
  ...base,
  NODE_ENV: "production",
  PORT: "4311",
  CLIENT_ORIGIN: "https://dating.project-iskra.com",
  PROMO_API_URL: "http://iskra-production:4310/api",
  MONGODB_URI: mongo.toString(),
  JWT_ACCESS_SECRET: stableSecret(existing, "JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: stableSecret(existing, "JWT_REFRESH_SECRET"),
  ZONE_QR_SECRET: stableSecret(existing, "ZONE_QR_SECRET"),
  UPLOAD_ROOT: "/app/uploads",
  STRIPE_SECRET_KEY: stripeSecret,
  STRIPE_WEBHOOK_SECRET: datingWebhook.startsWith("whsec_") ? datingWebhook : ""
};

for (const key of ["MONGODB_URI_live", "STRIPE_SECRET_KEY_live", "STRIPE_WEBHOOK_SECRET_live"]) delete runtime[key];
fs.writeFileSync(outputPath, `${Object.entries(runtime).map(([key, value]) => `${key}=${String(value).replace(/[\r\n]/g, "")}`).join("\n")}\n`, { mode: 0o600 });
