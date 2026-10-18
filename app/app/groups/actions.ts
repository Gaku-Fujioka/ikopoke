"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { createGroup, GroupStoreError } from "@/lib/groups/repository";
import { parseGroupInput } from "@/lib/groups/validation";

export async function createGroupAction(_previous: { error: string | null }, formData: FormData): Promise<{ error: string | null; fieldError?: boolean }> {
  if (!hasEnvVars) return { error: "グループ機能は準備中です。" };
  let input;
  try {
    input = parseGroupInput(formData.get("name"), formData.get("requestId"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "入力内容をご確認ください。", fieldError: true };
  }

  let groupId;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直して、もう一度お試しください。" };
    groupId = await createGroup(client, input);
  } catch (error) {
    return { error: error instanceof GroupStoreError ? error.message : "グループを保存できませんでした。もう一度お試しください。" };
  }
  revalidatePath("/app/groups");
  revalidatePath("/app");
  redirect(`/app/groups/${encodeURIComponent(groupId)}`);
}
