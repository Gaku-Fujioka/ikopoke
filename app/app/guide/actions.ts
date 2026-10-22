"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { GuideStoreError, markGuideSeen } from "@/lib/onboarding/repository";

export async function acknowledgeGuideAction(): Promise<{ error: string | null }> {
  if (!hasEnvVars) return { error: "ガイドの保存は準備中です。今回は閉じてアプリを使えます。" };
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直して、もう一度お試しください。" };
    await markGuideSeen(client, data.claims.sub);
  } catch (cause) {
    return { error: cause instanceof GuideStoreError ? cause.message : "ガイドの状態を保存できませんでした。もう一度お試しください。" };
  }
  revalidatePath("/app", "layout");
  return { error: null };
}
