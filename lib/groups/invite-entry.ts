import { INVITE_PATH, isInviteToken } from "./invite-cookie";

/** Keep a copyable fragment link in page memory while clearing the address bar. */
export function captureInviteEntry(browser: Pick<Window, "location" | "history">) {
  const { hash, origin, pathname, search } = browser.location;
  if (!hash) return null;
  const token = hash.slice(1);
  browser.history.replaceState(null, "", `${pathname}${search}`);
  return {
    token,
    handoffLink: isInviteToken(token) ? `${origin}${INVITE_PATH}#${token}` : null,
  };
}
