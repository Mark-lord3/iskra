/**
 * Profiles this guest has already liked or passed on tonight.
 *
 * The server excludes them from the next deck it builds, but the deck already
 * in the browser was fetched before those decisions were made. Keeping the ids
 * here lets the rendered queue drop them straight away, so nobody comes back
 * round while a refetch is still in flight, or after the view is remounted by
 * a trip to Messages and back.
 *
 * Session-scoped and per event: a decision is only meant to hold for tonight.
 */
const key = (eventId: string) => `iskra:decided:${eventId}`;

export function readDecided(storage: Pick<Storage, "getItem">, eventId: string): string[] {
  if (!eventId) return [];
  try {
    const raw = storage.getItem(key(eventId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function rememberDecided(storage: Pick<Storage, "getItem" | "setItem">, eventId: string, profileId: string) {
  if (!eventId || !profileId) return;
  const next = new Set(readDecided(storage, eventId));
  next.add(profileId);
  try {
    storage.setItem(key(eventId), JSON.stringify([...next]));
  } catch {
    // A full or disabled store is not worth failing a swipe over; the server
    // exclusion still holds on the next fetch.
  }
}

export function forgetDecided(storage: Pick<Storage, "getItem" | "setItem">, eventId: string, profileId: string) {
  if (!eventId || !profileId) return;
  const next = readDecided(storage, eventId).filter((id) => id !== profileId);
  try {
    storage.setItem(key(eventId), JSON.stringify(next));
  } catch {
    // As above - an undo that fails to persist still reaches the server.
  }
}
