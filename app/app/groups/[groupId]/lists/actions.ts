"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { createList, deleteList, ListStoreError, renameList, setItemList } from "@/lib/lists/repository";
import { listIds, listName } from "@/lib/lists/validation";

export type ListActionState = { error: string | null; saved?: boolean; name?: string };
const denied = "ログインし直して、もう一度お試しください。";

async function authorizedClient() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) throw new Error(denied);
  return client;
}
const message = (error: unknown) => error instanceof ListStoreError || error instanceof Error && error.message === denied ? error.message : error instanceof Error && (error.message.startsWith("リストの名前") || error.message.startsWith("画面を読み込み") || error.message === "リストの名前を入力してください。") ? error.message : "リストを保存できませんでした。もう一度お試しください。";

export async function createListAction(_previous: ListActionState, form: FormData): Promise<ListActionState> {
  if (!hasEnvVars) return { error: "リスト機能は準備中です。" };
  try {
    const [groupId, requestId] = listIds(form, "groupId", "requestId");
    const name = listName(form.get("name"));
    await createList(await authorizedClient(), groupId, name, requestId);
    revalidatePath(`/app/groups/${groupId}/lists`);
    return { error: null, saved: true, name };
  } catch (error) { return { error: message(error) }; }
}

export async function renameListAction(_previous: ListActionState, form: FormData): Promise<ListActionState> {
  if (!hasEnvVars) return { error: "リスト機能は準備中です。" };
  try {
    const [groupId, listId] = listIds(form, "groupId", "listId");
    const name = listName(form.get("name"));
    const expectedName = form.get("expectedName");
    if (typeof expectedName !== "string" || !expectedName) throw new Error("画面を読み込み直して、もう一度お試しください。");
    await renameList(await authorizedClient(), groupId, listId, name, expectedName);
    revalidatePath(`/app/groups/${groupId}/lists`);
    revalidatePath(`/app/groups/${groupId}/items`);
    return { error: null, saved: true, name };
  } catch (error) { return { error: message(error) }; }
}

export async function deleteListAction(_previous: ListActionState, form: FormData): Promise<ListActionState> {
  if (!hasEnvVars) return { error: "リスト機能は準備中です。" };
  try {
    const [groupId, listId] = listIds(form, "groupId", "listId");
    const expectedName = form.get("expectedName");
    if (typeof expectedName !== "string" || !expectedName) throw new Error("画面を読み込み直して、もう一度お試しください。");
    await deleteList(await authorizedClient(), groupId, listId, expectedName);
    revalidatePath(`/app/groups/${groupId}/lists`);
    revalidatePath(`/app/groups/${groupId}/items`);
    return { error: null, saved: true };
  } catch (error) { return { error: message(error) }; }
}

export async function setItemListAction(_previous: ListActionState, form: FormData): Promise<ListActionState> {
  if (!hasEnvVars) return { error: "リスト機能は準備中です。" };
  try {
    const [groupId, itemId, listId] = listIds(form, "groupId", "itemId", "listId");
    const selected = form.get("selected");
    if (selected !== "true" && selected !== "false") throw new Error("画面を読み込み直して、もう一度お試しください。");
    await setItemList(await authorizedClient(), groupId, itemId, listId, selected === "true");
    revalidatePath(`/app/groups/${groupId}/items/${itemId}`);
    revalidatePath(`/app/groups/${groupId}/items`);
    return { error: null, saved: true };
  } catch (error) { return { error: message(error) }; }
}
