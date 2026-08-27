export type Point = { x: number; y: number; floor: number };

export function bearingBetween(from: Point, to: Point) {
  const radians = Math.atan2(to.x - from.x, -(to.y - from.y));
  return (radians * 180) / Math.PI + (radians < 0 ? 360 : 0);
}

export function zoneDistance(from: Point, to: Point) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function freshness(updatedAt: Date | null, now = new Date()) {
  if (!updatedAt) return { state: "unknown" as const, seconds: null };
  const seconds = Math.max(0, Math.floor((now.getTime() - updatedAt.getTime()) / 1000));
  if (seconds < 30) return { state: "live" as const, seconds };
  if (seconds < 120) return { state: "aging" as const, seconds };
  return { state: "stale" as const, seconds };
}

export function proximityLabel(distance: number, sameZone: boolean) {
  if (sameZone) return "same area";
  if (distance < 20) return "very close";
  if (distance < 55) return "nearby";
  return "across the venue";
}
