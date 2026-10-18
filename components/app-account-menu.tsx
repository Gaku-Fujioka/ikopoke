import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { UserRound } from "lucide-react";
import Link from "next/link";

export async function AppAccountMenu() {
  if (!hasEnvVars) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return <Link href="/app/profile" className="kk-profile-link" aria-label="プロフィールとアカウント設定"><UserRound aria-hidden="true" size={20} /></Link>;
}
