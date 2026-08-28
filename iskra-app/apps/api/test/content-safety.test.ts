import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeText, containsBlockedLanguage } from "../src/lib/content-safety";

test("content safety detects spaced and punctuated abusive terms", () => {
  assert.equal(containsBlockedLanguage("f.u c-k"), true);
  assert.equal(containsBlockedLanguage("б л я д ь"), true);
});

test("content safety accepts ordinary event copy", () => {
  assert.equal(containsBlockedLanguage("Meet us by the main bar for dancing"), false);
  assert.doesNotThrow(() => assertSafeText("New in Montreal", "Come say hello near the dance floor."));
});
