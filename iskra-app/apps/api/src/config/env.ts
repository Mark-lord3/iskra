import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(currentDirectory, "../../.env");

config({ path: envPath });

const envSchema = z.object({
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
});

export const env = envSchema.parse(process.env);
