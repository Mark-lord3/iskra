import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(currentDirectory, "../../.env");

config({ path: envPath });

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4311),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5174"),
  PROMO_API_URL: z.string().url().default("http://localhost:4310/api"),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27018/iskra_app"),
  JWT_ACCESS_SECRET: z.string().min(16).default("local-development-access-secret"),
  JWT_REFRESH_SECRET: z.string().min(16).default("local-development-refresh-secret"),
  ZONE_QR_SECRET: z.string().min(16).default("local-development-zone-qr-secret"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  UPLOAD_ROOT: z.string().default(path.resolve(currentDirectory, "../../uploads")),
  MAX_IMAGE_SIZE_MB: z.coerce.number().default(8),
  MAX_CHAT_IMAGE_SIZE_MB: z.coerce.number().default(10),
  MAX_PROFILE_IMAGES: z.coerce.number().default(6),
  MAX_EVENT_STORAGE_GB: z.coerce.number().default(20),
  EVENT_MEDIA_RETENTION_MINUTES: z.coerce.number().default(60),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  MAPBOX_PUBLIC_TOKEN: z.string().min(1).default("pk.local-placeholder")
}).superRefine((values, context) => {
  if (values.NODE_ENV !== "production") return;

  const productionSecrets = [
    ["JWT_ACCESS_SECRET", values.JWT_ACCESS_SECRET],
    ["JWT_REFRESH_SECRET", values.JWT_REFRESH_SECRET],
    ["ZONE_QR_SECRET", values.ZONE_QR_SECRET]
  ] as const;

  for (const [name, value] of productionSecrets) {
    if (value.length < 32 || value.startsWith("local-development-")) {
      context.addIssue({ code: "custom", path: [name], message: `${name} must be a unique secret of at least 32 characters in production.` });
    }
  }
  if (new Set(productionSecrets.map(([, value]) => value)).size !== productionSecrets.length) {
    context.addIssue({ code: "custom", path: ["JWT_ACCESS_SECRET"], message: "Production signing secrets must be different from each other." });
  }
  if (!values.CLIENT_ORIGIN.startsWith("https://")) {
    context.addIssue({ code: "custom", path: ["CLIENT_ORIGIN"], message: "CLIENT_ORIGIN must use HTTPS in production." });
  }
  const promoUrl = new URL(values.PROMO_API_URL);
  const privateServiceUrl = promoUrl.protocol === "http:" && /^[a-z0-9-]+$/i.test(promoUrl.hostname);
  if (promoUrl.protocol !== "https:" && !privateServiceUrl) {
    context.addIssue({ code: "custom", path: ["PROMO_API_URL"], message: "PROMO_API_URL must use HTTPS or a private container hostname in production." });
  }
  if (/127\.0\.0\.1|localhost/.test(values.MONGODB_URI)) {
    context.addIssue({ code: "custom", path: ["MONGODB_URI"], message: "A dedicated non-local MongoDB database is required in production." });
  }
});

export const env = envSchema.parse(process.env);
