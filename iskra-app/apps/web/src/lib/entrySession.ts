export const ENTRY_DISMISSED_KEY = "iskra:entry-dismissed";

export function isEntryDismissed(storage: Pick<Storage, "getItem">) {
  return storage.getItem(ENTRY_DISMISSED_KEY) === "true";
}

export function rememberEntryDismissal(storage: Pick<Storage, "setItem">) {
  storage.setItem(ENTRY_DISMISSED_KEY, "true");
}
