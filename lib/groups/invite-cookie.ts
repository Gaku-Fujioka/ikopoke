export const INVITE_COOKIE = "kokoiko-pending-invite";
export const INVITE_PATH = "/app/groups/join";
export function isInviteToken(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
export function inviteCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: INVITE_PATH, maxAge: 60 * 60 * 24 * 7 };
}
