import assert from "node:assert/strict";
import test from "node:test";
import { bearingBetween, freshness, proximityLabel, zoneDistance } from "../src/lib/compass";

test("bearing uses venue map coordinates", () => {
  assert.equal(bearingBetween({ x: 10, y: 10, floor: 1 }, { x: 10, y: 20, floor: 1 }), 180);
  assert.equal(bearingBetween({ x: 10, y: 10, floor: 1 }, { x: 20, y: 10, floor: 1 }), 90);
});

test("distance and labels expose approximate proximity only", () => {
  assert.equal(zoneDistance({ x: 0, y: 0, floor: 1 }, { x: 3, y: 4, floor: 1 }), 5);
  assert.equal(proximityLabel(0, true), "same area");
  assert.equal(proximityLabel(12, false), "very close");
  assert.equal(proximityLabel(35, false), "nearby");
  assert.equal(proximityLabel(80, false), "across the venue");
});

test("freshness degrades without revealing a timestamp", () => {
  const now = new Date();
  assert.equal(freshness(new Date(now.getTime() - 4_000), now).state, "live");
  assert.equal(freshness(new Date(now.getTime() - 35_000), now).state, "aging");
  assert.equal(freshness(new Date(now.getTime() - 120_000), now).state, "stale");
  assert.equal(freshness(null, now).state, "unknown");
});
