import path from "node:path";
import { env } from "../config/env";

export function resolveUploadPath(relativePath: string) {
  const normalized = path.posix.normalize(relativePath);
  if (normalized.includes("..")) {
    throw new Error("Unsafe media path.");
  }

  return path.join(env.UPLOAD_ROOT, normalized);
}

