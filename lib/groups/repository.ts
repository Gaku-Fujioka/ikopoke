import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";

export type SavedGroup = Pick<Database["public"]["Tables"]["groups"]["Row"], "id" | "name" | "created_at">;

export class GroupStoreError extends Error {
  constructor(error: { code?: string } | null) {
    super(error && ["42P01", "PGRST202", "PGRST205"].includes(error.code ?? "")
      ? "グループ機能は準備中です。利用できるようになるまでお待ちください。"
      : "グループを読み書きできませんでした。通信状態をご確認のうえ、もう一度お試しください。");
    this.name = "GroupStoreError";
  }
}

export async function listGroups(client: SupabaseClient<Database>): Promise<SavedGroup[]> {
  // RLS, rather than a client-provided user ID, determines the visible groups.
  const { data, error } = await client.from("groups").select("id,name,created_at").order("created_at", { ascending: true }).order("id");
  if (error) throw new GroupStoreError(error);
  return data ?? [];
}

export async function getGroup(client: SupabaseClient<Database>, groupId: string): Promise<SavedGroup | null> {
  const { data, error } = await client.from("groups").select("id,name,created_at").eq("id", groupId).maybeSingle();
  if (error) throw new GroupStoreError(error);
  // Missing and non-member IDs have the same result, without disclosing a name.
  return data;
}

export async function createGroup(client: SupabaseClient<Database>, input: { name: string; requestId: string }): Promise<string> {
  const { data, error } = await client.rpc("create_group", { p_name: input.name, p_request_id: input.requestId });
  if (error || !data) throw new GroupStoreError(error);
  return data;
}
