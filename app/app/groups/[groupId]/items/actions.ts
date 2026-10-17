"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { createItem, ItemStoreError } from "@/lib/items/repository";
import { parseItemInput, ItemInputError, type ItemField } from "@/lib/items/validation";

export async function createItemAction(_previous: { error: string | null }, form: FormData): Promise<{ error: string | null; field?: ItemField }> {
  if (!hasEnvVars) return { error: "候補の共有機能は準備中です。" };
  let input;
  try { input = parseItemInput(form); }
  catch (error) { return { error: error instanceof ItemInputError ? error.message : "入力内容をご確認ください。", field: error instanceof ItemInputError ? error.field : undefined }; }
  let itemId;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直して、もう一度お試しください。" };
    itemId = await createItem(client, input);
  } catch (error) {
    return { error: error instanceof ItemStoreError ? error.message : "候補を保存できませんでした。もう一度お試しください。" };
  }
  const listPath = `/app/groups/${input.groupId}/items`;
  revalidatePath(listPath);
  redirect(`${listPath}/${encodeURIComponent(itemId)}`);
}
