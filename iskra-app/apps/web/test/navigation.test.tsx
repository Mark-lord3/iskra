import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { BottomNav } from "../src/components/BottomNav";
import { ENTRY_DISMISSED_KEY, isEntryDismissed, rememberEntryDismissal } from "../src/lib/entrySession";

function renderNavigation(path: string) {
  const client = new QueryClient();
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <BottomNav enabled={false} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

test("entry dismissal survives a route shell remount", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };

  assert.equal(isEntryDismissed(storage), false);
  rememberEntryDismissal(storage);
  assert.equal(values.get(ENTRY_DISMISSED_KEY), "true");
  assert.equal(isEntryDismissed(storage), true);
});

test("nested conversation keeps Messages active", () => {
  const html = renderNavigation("/messages/conversation-123");
  const active = html.match(/<a[^>]*aria-current="page"[^>]*href="([^"]+)"/);
  assert.equal(active?.[1], "/messages");
  assert.match(active?.[0] || "", /is-active/);
});

test("nested group keeps Groups active", () => {
  const html = renderNavigation("/groups/group-123");
  const active = html.match(/<a[^>]*aria-current="page"[^>]*href="([^"]+)"/);
  assert.equal(active?.[1], "/groups");
  assert.match(active?.[0] || "", /is-active/);
});
