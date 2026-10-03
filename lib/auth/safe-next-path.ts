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
