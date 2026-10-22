import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { hasSeenGuide } from "@/lib/onboarding/repository";
import { GuideDialog } from "./guide";

export async function FirstLoginGuide() {
  if (!hasEnvVars) return null;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub || await hasSeenGuide(client, data.claims.sub)) return null;
    return <GuideDialog />;
  } catch {
    // An optional introduction must not prevent using the app if its read fails.
    return null;
  }
}
