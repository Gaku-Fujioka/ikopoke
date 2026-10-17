import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

export async function AppAccountMenu() {
  if (!hasEnvVars) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return <div className="flex items-center gap-3 text-sm"><span>ログイン中</span><LogoutButton /></div>;
}
