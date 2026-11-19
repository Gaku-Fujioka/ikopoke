import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { hasSeenGuide } from "@/lib/onboarding/repository";
import { GuideDialog } from "./guide";

export async function FirstLoginGuide() {
  if (!hasEnvVars) return null;
  let client, data, error;
  try {
    client = await createClient();
    ({ data, error } = await client.auth.getClaims());
    if (error || !data?.claims?.sub || await hasSeenGuide(client, data.claims.sub)) return null;
  } catch {
    // An optional introduction must not prevent using the app if its read fails.
    return null;
  }
  return <GuideDialog />;
}
