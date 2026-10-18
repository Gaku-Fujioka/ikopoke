import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import type { ItemInput } from "./validation";
import { validItemSearch, type ItemFilters } from "@/lib/items/search";
import type { ItemEditInput } from "./edit";

export type SavedItem = Pick<Database["public"]["Tables"]["items"]["Row"], "id" | "group_id" | "title" | "kind" | "memo" | "created_at"> & { priority?: number; archived_at?: string | null; want_count?: number; visited?: boolean; score?: number };
export const ITEM_PAGE_SIZE = 20;
const columns = "id,group_id,title,kind,memo,created_at,priority,archived_at";

export class ItemStoreError extends Error {
  constructor(error: { code?: string } | null) {
    super(error && ["42P01", "PGRST202", "PGRST205"].includes(error.code ?? "")
      ? "候補の共有機能は準備中です。利用できるようになるまでお待ちください。"
      : error?.code === "40001"
        ? "この候補は別の画面で変更されています。入力内容を控えてから再読み込みし、最新の内容をご確認ください。"
      : error?.code === "23505"
        ? "同じ操作で別の内容が保存されています。候補一覧を確認してから、画面を開き直してください。"
        : "候補を読み書きできませんでした。ログイン状態や通信状態をご確認のうえ、もう一度お試しください。");
    this.name = "ItemStoreError";
  }
}

export async function listItems(client: SupabaseClient<Database>, groupId: string, page: number, query = "", filters: ItemFilters = {}): Promise<{ items: SavedItem[]; total: number }> {
  if (!validItemSearch(query)) throw new ItemStoreError(null);
  return browseItems(client, groupId, page, query, filters);
}

export async function getItem(client: SupabaseClient<Database>, groupId: string, itemId: string): Promise<SavedItem | null> {
  const { data, error } = await client.from("items").select(columns).eq("group_id", groupId).eq("id", itemId).maybeSingle();
  if (error) throw new ItemStoreError(error);
  return data;
}

export async function createItem(client: SupabaseClient<Database>, input: ItemInput): Promise<string> {
  const { data, error } = await client.rpc("create_item", {
    p_group_id: input.groupId, p_title: input.title, p_kind: input.kind, p_memo: input.memo, p_request_id: input.requestId,
  });
  if (error || !data) throw new ItemStoreError(error);
  return data;
}

export async function updateItem(client: SupabaseClient<Database>, input: ItemEditInput): Promise<void> {
  const { data, error } = await client.rpc("update_item", {
    p_group_id: input.groupId, p_item_id: input.itemId, p_title: input.title, p_memo: input.memo,
    p_expected_title: input.expectedTitle, p_expected_memo: input.expectedMemo,
  });
  if (error || data !== input.itemId) throw new ItemStoreError(error);
}


export async function browseItems(client: SupabaseClient<Database>, groupId: string | null, page: number, query = "", filters: ItemFilters = {}): Promise<{ items: SavedItem[]; total: number }> {
  if (!validItemSearch(query)) throw new ItemStoreError(null);
  const { data, error } = await client.rpc("browse_items", {
    p_group_id: groupId, p_query: query, p_kind: filters.kind ?? null, p_reaction: filters.reaction ?? null,
    p_list_id: filters.list && filters.list !== "unclassified" ? filters.list : null, p_unclassified: filters.list === "unclassified",
    p_archived: filters.archived ?? false, p_visited: filters.visited ?? null, p_priority: filters.priority ?? null,
    p_sort: filters.sort ?? "newest", p_page: page,
  });
  const row = data?.[0];
  if (error || !row || !Array.isArray(row.items) || row.items.length > ITEM_PAGE_SIZE || !Number.isSafeInteger(row.total_count) || row.total_count < 0 || row.items.some(i =>
    !/^[0-9a-f-]{36}$/i.test(i.id) || !/^[0-9a-f-]{36}$/i.test(i.group_id) || (groupId && i.group_id !== groupId) || typeof i.title !== "string" || !["spot", "activity"].includes(i.kind) || typeof i.memo !== "string" || typeof i.created_at !== "string" || !Number.isInteger(i.priority) || i.priority < 0 || i.priority > 3 || typeof i.visited !== "boolean" || !Number.isSafeInteger(i.want_count) || i.want_count < 0
  )) throw new ItemStoreError(error);
  return { items: row.items.map(i => ({ id:i.id,group_id:i.group_id,title:i.title,kind:i.kind,memo:i.memo,created_at:i.created_at,priority:i.priority,archived_at:i.archived_at,want_count:i.want_count,visited:i.visited,score:i.score })), total:row.total_count };
}
