"use server";

import { revalidatePath } from "next/cache";
import { revalidateSharedHome } from "@/lib/home/revalidate";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { updateItem, ItemStoreError } from "@/lib/items/repository";
import { parseItemEdit, type ItemEditState } from "@/lib/items/edit";
import { ItemInputError } from "@/lib/items/validation";

export async function updateItemAction(_previous: ItemEditState, form: FormData): Promise<ItemEditState> {
  if (!hasEnvVars) return { error: "候補の共有機能は準備中です。" };
  let input;
  try { input = parseItemEdit(form); }
  catch (error) {
    return { error: error instanceof ItemInputError ? error.message : "入力内容をご確認ください。",
      field: error instanceof ItemInputError && (error.field === "title" || error.field === "memo") ? error.field : undefined };
  }
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直して、もう一度お試しください。" };
    await updateItem(client, input);
  } catch (error) {
    return { error: error instanceof ItemStoreError ? error.message : "候補を保存できませんでした。もう一度お試しください。" };
  }
  revalidatePath(`/app/groups/${input.groupId}/items`);
  revalidatePath(`/app/groups/${input.groupId}/items/${input.itemId}`);
  revalidateSharedHome(input.groupId, "items");
  return { error: null, saved: { title: input.title, memo: input.memo } };
}
