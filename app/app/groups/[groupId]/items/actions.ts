"use server";
import { setItemList } from "@/lib/lists/repository";
import { isGroupId } from "@/lib/groups/validation";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { revalidateSharedHome } from "@/lib/home/revalidate";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { createItem, ItemStoreError } from "@/lib/items/repository";
import { parseItemInput, ItemInputError, type ItemField } from "@/lib/items/validation";

export async function createItemAction(_previous: { error: string | null }, form: FormData): Promise<{ error: string | null; field?: ItemField; createdItemId?: string }> {
  if (!hasEnvVars) return { error: "候補の共有機能は準備中です。" };
  let input;
  try { input = parseItemInput(form); }
  catch (error) { return { error: error instanceof ItemInputError ? error.message : "入力内容をご確認ください。", field: error instanceof ItemInputError ? error.field : undefined }; }
  const listIds = [...new Set(form.getAll("listIds"))];
  if (listIds.length > 20 || !listIds.every(isGroupId)) return { error: "リストを選び直してください。" };
  let itemId;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直して、もう一度お試しください。" };
    itemId = await createItem(client, input);
    for (const listId of listIds) await setItemList(client, input.groupId, itemId, listId as string, true);
  } catch (error) {
    if (itemId) { revalidatePath(`/app/groups/${input.groupId}/items`); revalidateSharedHome(input.groupId, "items"); return { error: "候補は保存しましたが、リストの分類を完了できませんでした。保存した候補で分類をご確認ください。", createdItemId: itemId }; }
    return { error: error instanceof ItemStoreError ? error.message : "候補を保存できませんでした。もう一度お試しください。" };
  }
  const listPath = `/app/groups/${input.groupId}/items`;
  revalidatePath(listPath);
  revalidateSharedHome(input.groupId, "items");
  redirect(`${listPath}/${encodeURIComponent(itemId)}`);
}
