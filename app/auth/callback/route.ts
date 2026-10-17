import { createClient } from "@/lib/supabase/server";
import { confirmationNextPath } from "@/lib/auth/safe-next-path";
import { hasEnvVars } from "@/lib/utils";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

/** Exchange the one-time PKCE code before navigating to an app screen. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!hasEnvVars) redirect("/auth/error?reason=configuration");
  if (!code) redirect("/auth/error?reason=confirmation");

  let verified = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } catch {
    // Report a fixed reason; authorization codes must never enter error URLs.
  }
  const next = confirmationNextPath(request.nextUrl.searchParams.get("next"));
  redirect(verified ? next : "/auth/error?reason=confirmation");
}
