import { createClient } from "@/lib/supabase/server";
import { confirmationNextPath } from "@/lib/auth/safe-next-path";
import { hasEnvVars } from "@/lib/utils";
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = confirmationNextPath(searchParams.get("next"), type);

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
