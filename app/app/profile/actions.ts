"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { parseDisplayName } from "@/lib/profiles/validation";
import { ProfileStoreError, setMyDisplayName } from "@/lib/profiles/repository";

export type ProfileActionState = { error: string | null; savedName?: string };

export async function saveProfileAction(_previous: ProfileActionState, form: FormData): Promise<ProfileActionState> {
  if (!hasEnvVars) return { error: "表示名の設定は準備中です。" };
  let name: string;
  try { name = parseDisplayName(form.get("displayName")); }
  catch (cause) { return { error: cause instanceof Error ? cause.message : "表示名を確認してください。" }; }
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直して、もう一度お試しください。" };
    await setMyDisplayName(client, name);
  } catch (cause) {
    return { error: cause instanceof ProfileStoreError ? cause.message : "表示名を保存できませんでした。もう一度お試しください。" };
  }
  revalidatePath("/app/profile");
  return { error: null, savedName: name };
}
