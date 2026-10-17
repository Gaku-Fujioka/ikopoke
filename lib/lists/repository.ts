import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { titleSearchFilter } from "@/lib/items/search";
import { LIST_PAGE_SIZE, validListQuery } from "./validation";

export type SavedList = Pick<Database["public"]["Tables"]["lists"]["Row"], "id" | "group_id" | "name" | "created_at">;
export type ItemList = { id: string; name: string; is_selected: boolean };
const columns = "id,group_id,name,created_at";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ListStoreError extends Error {
  constructor(error: { code?: string } | null) {
    super(error && ["42P01", "PGRST202", "PGRST205"].includes(error.code ?? "")
      ? "リスト機能は準備中です。利用できるようになるまでお待ちください。"
      : error?.code === "40001" ? "リスト名が別の画面で変更されています。再読み込みして最新の名前をご確認ください。"
      : error?.code === "23505" ? "同じ操作で別の内容が保存されています。画面を開き直してください。"
      : "リストを読み書きできませんでした。ログイン状態や通信状態をご確認のうえ、もう一度お試しください。");
    this.name = "ListStoreError";
  }
}

export async function listLists(client: SupabaseClient<Database>, groupId: string, page: number, query = ""): Promise<{ lists: SavedList[]; total: number }> {
  if (!validListQuery(query)) throw new ListStoreError(null);
  let request = client.from("lists").select(columns, { count: "exact" }).eq("group_id", groupId);
  if (query) request = request.filter("name", "imatch", titleSearchFilter(query));
  const start = (page - 1) * LIST_PAGE_SIZE;
  const { data, error, count } = await request.order("created_at", { ascending: false }).order("id", { ascending: false }).range(start, start + LIST_PAGE_SIZE - 1);
  if (error) throw new ListStoreError(error);
  return { lists: data ?? [], total: count ?? 0 };
}

export async function getList(client: SupabaseClient<Database>, groupId: string, listId: string): Promise<SavedList | null> {
  const { data, error } = await client.from("lists").select(columns).eq("group_id", groupId).eq("id", listId).maybeSingle();
  if (error) throw new ListStoreError(error);
  return data;
}

export async function createList(client: SupabaseClient<Database>, groupId: string, name: string, requestId: string): Promise<string> {
  const { data, error } = await client.rpc("create_list", { p_group_id: groupId, p_name: name, p_request_id: requestId });
  if (error || !data) throw new ListStoreError(error);
  return data;
}

export async function renameList(client: SupabaseClient<Database>, groupId: string, listId: string, name: string, expectedName: string): Promise<void> {
  const { error } = await client.rpc("rename_list", { p_group_id: groupId, p_list_id: listId, p_name: name, p_expected_name: expectedName });
  if (error) throw new ListStoreError(error);
}

export async function deleteList(client: SupabaseClient<Database>, groupId: string, listId: string, expectedName: string): Promise<void> {
  const { error } = await client.rpc("delete_list", { p_group_id: groupId, p_list_id: listId, p_expected_name: expectedName });
  if (error) throw new ListStoreError(error);
}

export async function setItemList(client: SupabaseClient<Database>, groupId: string, itemId: string, listId: string, selected: boolean): Promise<void> {
  const { error } = await client.rpc("set_item_list", { p_group_id: groupId, p_item_id: itemId, p_list_id: listId, p_selected: selected });
  if (error) throw new ListStoreError(error);
}

export async function getItemLists(client: SupabaseClient<Database>, groupId: string, itemId: string, page: number, query = ""): Promise<{ lists: ItemList[]; total: number }> {
  if (!validListQuery(query)) throw new ListStoreError(null);
  const { data, error } = await client.rpc("get_item_lists", { p_group_id: groupId, p_item_id: itemId, p_query: query, p_page: page });
  if (error) throw new ListStoreError(error);
  const row = data?.[0];
  if (!row || !Array.isArray(row.lists) || row.lists.length > LIST_PAGE_SIZE || !Number.isSafeInteger(row.total_count) || row.total_count < 0 || row.lists.some(item => !uuid.test(item.id) || typeof item.name !== "string" || typeof item.is_selected !== "boolean")) throw new ListStoreError(null);
  return { lists: row.lists.map(item => ({ id: item.id, name: item.name, is_selected: item.is_selected })), total: row.total_count };
}
