import { runEventCleanupPass } from "../services/cleanup-service";

export function startCleanupJob() {
  const intervalMs = 5 * 60_000;

  runEventCleanupPass().catch((error) => {
    console.error("Initial cleanup pass failed", error);
  });

  return setInterval(() => {
    runEventCleanupPass().catch((error) => {
      console.error("Scheduled cleanup pass failed", error);
    });
  }, intervalMs);
}

