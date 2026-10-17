import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";

export async function AppAccountMenu() {
  if (!hasEnvVars) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return <div className="flex items-center gap-3 text-sm"><Link href="/app/profile" className="min-h-11 content-center font-semibold text-orange-700 underline underline-offset-4">表示名</Link><LogoutButton /></div>;
}
