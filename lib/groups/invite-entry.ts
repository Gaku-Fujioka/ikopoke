import { INVITE_PATH, isInviteToken } from "./invite-cookie";

type InviteLocation = Pick<Location, "hash" | "origin">;
function readInviteEntry(location: InviteLocation) {
  if (!location.hash) return null;
  const token = location.hash.slice(1);
  return { token, handoffLink: isInviteToken(token) ? `${location.origin}${INVITE_PATH}#${token}` : null };
}

/** One page-scoped browser snapshot survives address cleanup, without persistent storage. */
export function createInviteEntrySnapshot(location: () => InviteLocation) {
  let snapshot: ReturnType<typeof readInviteEntry> | undefined;
  return {
    subscribe: () => () => {},
    getSnapshot() {
      if (snapshot === undefined) snapshot = readInviteEntry(location());
      return snapshot;
    },
    getServerSnapshot: () => null,
  };
}

/** Keep a copyable fragment link in page memory while clearing the address bar. */
export function captureInviteEntry(browser: Pick<Window, "location" | "history">) {
  const entry = readInviteEntry(browser.location);
  if (!entry) return null;
  const { pathname, search } = browser.location;
  browser.history.replaceState(null, "", `${pathname}${search}`);
  return entry;
}
