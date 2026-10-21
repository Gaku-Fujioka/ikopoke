import { createClient } from "@/lib/supabase/server";
import { confirmationNextPath } from "@/lib/auth/safe-next-path";
import { hasEnvVars } from "@/lib/utils";
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

/** Unwrap only our signup callback, never redirect to a supplied absolute URL. */
function callbackNextPath(redirectTo: string | null, origin: string): string | null {
  if (!redirectTo) return null;
  try {
    const callback = new URL(redirectTo);
    if (callback.origin !== origin || callback.username || callback.password || callback.pathname !== "/auth/callback") {
      return null;
    }
    return callback.searchParams.get("next");
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = confirmationNextPath(
    searchParams.get("next") ?? callbackNextPath(searchParams.get("redirect_to"), origin),
    type,
  );

  if (!hasEnvVars) redirect("/auth/error?reason=configuration");

  if (!token_hash || !type || !["email", "signup", "recovery"].includes(type)) {
    redirect("/auth/error?reason=confirmation");
  }

  let verified = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    verified = !error;
  } catch {
    // Do not expose tokens, provider messages, or request details in a URL.
  }
  // Next.js redirect throws; keep it outside the provider error handler.
  redirect(verified ? next : "/auth/error?reason=confirmation");
}
