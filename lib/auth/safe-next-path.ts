const appOrigin = "http://kokoiko.local";

/** Limit post-confirmation navigation to paths on this app. */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/";
  }

  try {
    const url = new URL(next, appOrigin);
    if (url.origin !== appOrigin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/** Login may resume app screens, but must not loop through auth endpoints. */
export function appNextPath(next: string | null): string {
  const path = safeNextPath(next);
  const pathname = new URL(path, appOrigin).pathname;
  return pathname === "/app" || pathname.startsWith("/app/") ? path : "/app";
}

/** Recovery is the only auth page that a confirmation may lead to. */
export function confirmationNextPath(next: string | null, type?: string | null): string {
  if (type === "recovery") return "/auth/update-password";
  const path = safeNextPath(next);
  return path === "/auth/update-password" ? path : appNextPath(path);
}
