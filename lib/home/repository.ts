import { withMemoryCovers } from "@/lib/memories/repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import type { ItemFilters } from "@/lib/items/search";
import { browseItems } from "@/lib/items/repository";
import { isGroupId } from "@/lib/groups/validation";

export type Activity = {
  event_key: string; group_id: string; kind: "item" | "want_to_go" | "not_now" | "comment" | "outing" | "visit" | "memory";
  subject_id: string; title: string; actor_name: string | null; is_mine: boolean; occurred_at: string;
};
export type ActivityCursor = { at: string; key: string };
export type HomeClient = SupabaseClient<Database>;
export const PAGE_SIZE = 20;
export class HomeStoreError extends Error {
  constructor(code?: string) {
    super(["42P01", "PGRST202", "PGRST205"].includes(code ?? "") ? "近況の共有は準備中です。候補や計画はそれぞれのタブから開けます。" : "読み込めませんでした。通信状態をご確認のうえ、再読み込みしてください。");
    this.name = "HomeStoreError";
  }
}

export async function getActivity(client: HomeClient, groupId: string | null, limit = 13, cursor?: ActivityCursor): Promise<Activity[]> {
  const { data, error } = await client.rpc("get_home_activity", { p_group_id: groupId, p_limit: limit, p_before_at: cursor?.at ?? null, p_before_key: cursor?.key ?? null });
  if (error) throw new HomeStoreError(error.code);
  if (!Array.isArray(data) || data.length > limit) throw new HomeStoreError();
  // Project only the UI contract: no user IDs, provider details or extra fields.
  return data.map(row => {
    if (!/^[a-f0-9]{32}$/.test(row.event_key) || !isGroupId(row.group_id) || !isGroupId(row.subject_id) || typeof row.title !== "string" || (row.actor_name !== null && typeof row.actor_name !== "string") || typeof row.is_mine !== "boolean" || !["item", "want_to_go", "not_now", "comment", "outing", "visit", "memory"].includes(row.kind) || !Number.isFinite(Date.parse(row.occurred_at)) || (groupId && row.group_id !== groupId)) throw new HomeStoreError();
    return { event_key: row.event_key, group_id: row.group_id, kind: row.kind as Activity["kind"], subject_id: row.subject_id, title: row.title, actor_name: row.actor_name, is_mine: row.is_mine, occurred_at: row.occurred_at };
  });
}

export async function nextOuting(client: HomeClient, groupId: string | null, today: string) {
  let query = client.from("outings").select("id,group_id,title,outing_date,mode").is("completed_at", null).gte("outing_date", today);
  if (groupId) query = query.eq("group_id", groupId);
  const { data, error } = await query.order("outing_date").order("id").limit(1).maybeSingle();
  if (error) throw new HomeStoreError(error.code);
  return data;
}

export async function recentCandidates(client: HomeClient, groupId: string | null) {
  let query = client.from("items").select("id,group_id,title,kind").is("archived_at", null);
  if (groupId) query = query.eq("group_id", groupId);
  const { data, error } = await query.order("created_at", { ascending: false }).order("id").limit(3);
  if (error) throw new HomeStoreError(error.code);
  return data ?? [];
}

export async function globalItems(client: HomeClient, page: number, text: string, kind: string, filters: ItemFilters = {}) {
  const result = await browseItems(client, null, page, text, { ...filters, kind: kind === "spot" || kind === "activity" ? kind : undefined });
  return { rows: result.items, total: result.total };
}
export async function globalOutings(client: HomeClient, page: number, completed: boolean) {
  let query = client.from("outings").select("id,group_id,title,outing_date,completed_at", { count: "exact" });
  query = completed ? query.not("completed_at", "is", null) : query.is("completed_at", null);
  const { data, error, count } = await query.order("outing_date", { ascending: !completed }).order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new HomeStoreError(error.code);
  return { rows: data ?? [], total: count ?? 0 };
}
export async function globalMemories(client: HomeClient, page: number) {
  const { data, error, count } = await client.from("memories").select("id,group_id,title,memory_date,note,cover_photo_id", { count: "exact" }).order("memory_date", { ascending: false }).order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new HomeStoreError(error.code);
  return { rows: await withMemoryCovers(client, data ?? []), total: count ?? 0 };
}
