"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { renameGroup, GroupStoreError } from "@/lib/groups/repository";
import { parseGroupRename, type RenameGroupState } from "@/lib/groups/rename";

export async function renameGroupAction(_previous: RenameGroupState, form: FormData): Promise<RenameGroupState> {
  if (!hasEnvVars) return { error: "グループ機能は準備中です。" };
  let input;
  try { input = parseGroupRename(form); }
  catch (error) { return { error: error instanceof Error ? error.message : "入力内容をご確認ください。" }; }
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直して、もう一度お試しください。" };
    await renameGroup(client, input);
  } catch (error) {
    return { error: error instanceof GroupStoreError ? error.message : "グループ名を保存できませんでした。もう一度お試しください。" };
  }
  revalidatePath("/app/groups");
  revalidatePath("/app");
  revalidatePath("/app/items");
  revalidatePath("/app/outings");
  revalidatePath("/app/memories");
  revalidatePath("/app/activity");
  revalidatePath(`/app/groups/${input.groupId}/activity`);
  revalidatePath(`/app/groups/${input.groupId}/settings`);
  revalidatePath(`/app/groups/${input.groupId}`);
  revalidatePath(`/app/groups/${input.groupId}/items`);
  revalidatePath(`/app/groups/${input.groupId}/items/[itemId]`, "page");
  return { error: null, savedName: input.name };
}
