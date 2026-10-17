import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import type { ItemInput } from "./validation";

export type SavedItem = Pick<Database["public"]["Tables"]["items"]["Row"], "id" | "group_id" | "title" | "kind" | "memo" | "created_at">;
export const ITEM_PAGE_SIZE = 20;
const columns = "id,group_id,title,kind,memo,created_at";

export class ItemStoreError extends Error {
  constructor(error: { code?: string } | null) {
    super(error && ["42P01", "PGRST202", "PGRST205"].includes(error.code ?? "")
      ? "候補の共有機能は準備中です。利用できるようになるまでお待ちください。"
      : error?.code === "23505"
        ? "同じ操作で別の内容が保存されています。候補一覧を確認してから、画面を開き直してください。"
        : "候補を読み書きできませんでした。ログイン状態や通信状態をご確認のうえ、もう一度お試しください。");
    this.name = "ItemStoreError";
  }
}

export async function listItems(client: SupabaseClient<Database>, groupId: string, page: number): Promise<{ items: SavedItem[]; total: number }> {
  const start = (page - 1) * ITEM_PAGE_SIZE;
  const { data, error, count } = await client.from("items").select(columns, { count: "exact" }).eq("group_id", groupId)
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
