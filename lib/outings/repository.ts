import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { OutingInput, OutingMode, OutingPeriod } from "./validation";

export type SavedOuting = { id: string; group_id: string; title: string; outing_date: string; end_date: string; cancelled_at: string | null; plan_format: number; mode: OutingMode; memo: string; revision: number; completed_at: string | null; created_at: string; updated_at: string };
export type SavedOutingItem = { id: string; day_index: number; item_id: string; position: number; planned_time: string | null; period: OutingPeriod | null };
export type CandidateOption = { id: string; title: string; kind: "spot" | "activity"; archived_at: string | null };
export type OutingDetail = { outing: SavedOuting; items: SavedOutingItem[]; participants: string[]; days: { day_index: number; mode: OutingMode; participants: string[] }[] };

export class OutingStoreError extends Error {
  constructor(code?: string) {
    super(code === "40001" ? "ほかの画面で計画が変更されました。入力内容を控えてから再読み込みし、最新の計画をご確認ください。" :
      ["42P01", "PGRST202", "PGRST205"].includes(code ?? "") ? "計画機能は準備中です。" :
      "計画を読み書きできませんでした。所属や通信状態をご確認のうえ、もう一度お試しください。");
    this.name = "OutingStoreError";
  }
}

export async function listOutings(client: SupabaseClient<Database>, groupId: string): Promise<SavedOuting[]> {
  const result: SavedOuting[] = [];
  for (let start = 0; start < 10000; start += 1000) {
    const { data, error } = await client.from("outings").select("id,group_id,title,outing_date,end_date,cancelled_at,plan_format,mode,memo,revision,completed_at,created_at,updated_at").eq("group_id",groupId).order("outing_date",{ascending:true}).order("id").range(start,start+999);
    if (error) throw new OutingStoreError(error.code);
    result.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return result;
  }
  throw new OutingStoreError();
}

export async function getOuting(client: SupabaseClient<Database>, groupId: string, outingId: string): Promise<OutingDetail | null> {
  const { data: outing, error } = await client.from("outings").select("id,group_id,title,outing_date,end_date,cancelled_at,plan_format,mode,memo,revision,completed_at,created_at,updated_at").eq("group_id",groupId).eq("id",outingId).maybeSingle();
  if (error) throw new OutingStoreError(error.code);
  if (!outing) return null;
  const [items, participants, days] = await Promise.all([
    client.from("outing_items").select("id,day_index,item_id,position,planned_time,period").eq("group_id",groupId).eq("outing_id",outingId).order("position"),
    client.from("outing_participants").select("user_id").eq("group_id",groupId).eq("outing_id",outingId),
    client.from("outing_days").select("day_index,mode,participants").eq("group_id",groupId).eq("outing_id",outingId).order("day_index"),
  ]);
  if (items.error || participants.error || days.error) throw new OutingStoreError(items.error?.code ?? participants.error?.code ?? days.error?.code);
  return { outing, items: items.data ?? [], participants: (participants.data ?? []).map(row => row.user_id), days: days.data ?? [] };
}

export async function listCandidateOptions(client: SupabaseClient<Database>, groupId: string): Promise<CandidateOption[]> {
  const result: CandidateOption[] = [];
  for (let start = 0; start < 10000; start += 1000) {
    const { data, error } = await client.from("items").select("id,title,kind,archived_at").eq("group_id",groupId).order("created_at").order("id").range(start,start+999);
    if (error) throw new OutingStoreError(error.code);
    result.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return result;
  }
  throw new OutingStoreError();
}

export async function saveOuting(client: SupabaseClient<Database>, input: OutingInput): Promise<number> {
  const { data, error } = await client.rpc("save_outing", {
    p_group_id: input.groupId, p_outing_id: input.outingId, p_expected_revision: input.expectedRevision,
    p_title: input.title, p_date: input.date, p_mode: input.mode, p_memo: input.memo,
    p_items: input.items, p_participants: input.participants,
  });
  if (error || typeof data !== "number") throw new OutingStoreError(error?.code);
  return data;
}
