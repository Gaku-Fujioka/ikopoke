import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import type { ItemInput } from "./validation";
import { titleSearchFilter, validItemSearch, type ItemFilters } from "@/lib/items/search";
import type { ItemEditInput } from "./edit";

export type SavedItem = Pick<Database["public"]["Tables"]["items"]["Row"], "id" | "group_id" | "title" | "kind" | "memo" | "created_at">;
export const ITEM_PAGE_SIZE = 20;
const columns = "id,group_id,title,kind,memo,created_at";

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
  if (filters.list) {
    const { data, error } = await client.rpc("get_group_items", {
      p_group_id: groupId, p_query: query, p_kind: filters.kind ?? null, p_reaction: filters.reaction ?? null,
      p_list_id: filters.list === "unclassified" ? null : filters.list,
      p_unclassified: filters.list === "unclassified", p_page: page,
    });
    if (error) throw new ItemStoreError(error);
    const row = data?.[0];
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!row || !Array.isArray(row.items) || row.items.length > ITEM_PAGE_SIZE || !Number.isSafeInteger(row.total_count) || row.total_count < 0 || row.items.some(item =>
      !uuid.test(item.id) || item.group_id !== groupId || typeof item.title !== "string" || !["spot", "activity"].includes(item.kind) || typeof item.memo !== "string" || typeof item.created_at !== "string"
    )) throw new ItemStoreError(null);
    return { items: row.items.map(item => ({ id: item.id, group_id: item.group_id, title: item.title, kind: item.kind, memo: item.memo, created_at: item.created_at })), total: row.total_count };
  }
  const start = (page - 1) * ITEM_PAGE_SIZE;
  const reactionRequest = (reaction: NonNullable<ItemFilters["reaction"]>) => {
    const feed = client.from("shared_item_feed").select(columns, { count: "exact" });
    return reaction === "unreacted" ? feed.is("my_reaction", null) : feed.eq("my_reaction", reaction);
  };
  let request = (filters.reaction ? reactionRequest(filters.reaction) : client.from("items").select(columns, { count: "exact" })).eq("group_id", groupId);
  if (filters.kind) request = request.eq("kind", filters.kind);
  if (query) request = request.filter("title", "imatch", titleSearchFilter(query));
  const { data, error, count } = await request
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(start, start + ITEM_PAGE_SIZE - 1);
  if (error) throw new ItemStoreError(error);
  return { items: data ?? [], total: count ?? 0 };
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
