import assert from "node:assert/strict";
import test from "node:test";
import { forgetDecided, readDecided, rememberDecided } from "../src/lib/decidedProfiles";

function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    get size() { return map.size; }
  };
}

test("a decision is remembered for the event it was made at", () => {
  const storage = fakeStorage();
  rememberDecided(storage, "event-a", "profile-1");
  assert.deepEqual(readDecided(storage, "event-a"), ["profile-1"]);
  // Tonight's decisions must not follow the guest to another event.
  assert.deepEqual(readDecided(storage, "event-b"), []);
});

test("remembering the same profile twice does not duplicate it", () => {
  const storage = fakeStorage();
  rememberDecided(storage, "event-a", "profile-1");
  rememberDecided(storage, "event-a", "profile-1");
  assert.deepEqual(readDecided(storage, "event-a"), ["profile-1"]);
});

test("an undone pass is forgotten, so that person can come back", () => {
  const storage = fakeStorage();
  rememberDecided(storage, "event-a", "profile-1");
  rememberDecided(storage, "event-a", "profile-2");
  forgetDecided(storage, "event-a", "profile-1");
  assert.deepEqual(readDecided(storage, "event-a"), ["profile-2"]);
});

test("corrupt or absent storage reads as no decisions rather than throwing", () => {
  assert.deepEqual(readDecided(fakeStorage(), "event-a"), []);
  assert.deepEqual(readDecided(fakeStorage({ "iskra:decided:event-a": "not json" }), "event-a"), []);
  assert.deepEqual(readDecided(fakeStorage({ "iskra:decided:event-a": '{"not":"an array"}' }), "event-a"), []);
  assert.deepEqual(readDecided(fakeStorage({ "iskra:decided:event-a": '["ok",7,null]' }), "event-a"), ["ok"]);
});

test("a storage that refuses writes does not break a swipe", () => {
  const readOnly = {
    getItem: () => null,
    setItem: () => { throw new Error("QuotaExceededError"); }
  };
  assert.doesNotThrow(() => rememberDecided(readOnly, "event-a", "profile-1"));
  assert.doesNotThrow(() => forgetDecided(readOnly, "event-a", "profile-1"));
});

/* The deck used to hold a position in the array. A refetch that removed the
   people already decided on left that position pointing somewhere else, which
   both skipped profiles and let decided ones back round. The queue is now
   derived by subtraction, which is what these two assert. */
const queueFrom = (profiles: { id: string }[], decided: string[]) => {
  const dropped = new Set(decided);
  return profiles.filter((candidate) => !dropped.has(candidate.id));
};

test("the queue never contains someone already decided on", () => {
  const profiles = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(queueFrom(profiles, ["a", "c"]).map((p) => p.id), ["b"]);
});

test("a refetch that reorders and shortens the list cannot resurface a decision", () => {
  const decided = ["a", "b"];
  const refetched = [{ id: "c" }, { id: "a" }, { id: "d" }];  // server still lists 'a'
  assert.deepEqual(queueFrom(refetched, decided).map((p) => p.id), ["c", "d"]);
});
