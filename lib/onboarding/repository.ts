import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { GUIDE_VERSION } from "./guide";

export class GuideStoreError extends Error {
  constructor() {
    super("ガイドの表示済み状態を保存できませんでした。もう一度お試しいただくか、今回は閉じてください。");
    this.name = "GuideStoreError";
  }
}

export async function hasSeenGuide(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.from("profiles").select("onboarding_version").eq("user_id", userId).maybeSingle();
  if (error || (data && (!Number.isSafeInteger(data.onboarding_version) || data.onboarding_version < 0))) throw new GuideStoreError();
  return data ? data.onboarding_version >= GUIDE_VERSION : false;
}

export async function markGuideSeen(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.from("profiles").update({ onboarding_version: GUIDE_VERSION }).eq("user_id", userId).select("user_id").single();
  if (error || data?.user_id !== userId) throw new GuideStoreError();
}
