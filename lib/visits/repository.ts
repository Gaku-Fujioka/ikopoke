import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { recordVisitInput } from "./validation";
export type SavedVisit = Omit<Database["public"]["Tables"]["visits"]["Row"],"created_by">;
export type VisitPhoto = Omit<Database["public"]["Tables"]["visit_photos"]["Row"],"created_by">;
export type VisitRatings = { rating_count: number; average_rating: number | null; my_rating: number | null };
const columns="id,group_id,item_id,outing_id,item_title,visited_on,note,revision,created_at";
export class VisitStoreError extends Error {
  constructor(code?: string) {
    super(code==="40001" ? "この記録は別の画面で変更されました。入力を控えてから再読み込みしてください。" : code==="54000" ? "写真は1回の訪問につき10枚までです。未完了の送信がある場合は、確認か中断をしてください。" : "訪問記録を読み書きできませんでした。所属や通信状態をご確認のうえ、もう一度お試しください。");
    this.name="VisitStoreError";
  }
}
export async function listVisits(client: SupabaseClient<Database>, groupId: string, page=1, filter?: { itemId?: string; outingId?: string }): Promise<{ visits: SavedVisit[]; total: number }> {
  let query=client.from("visits").select(columns,{count:"exact"}).eq("group_id",groupId);
  if (filter?.itemId) query=query.eq("item_id",filter.itemId);
  if (filter?.outingId) query=query.eq("outing_id",filter.outingId);
  const {data,error,count}=await query.order("visited_on",{ascending:false}).order("created_at",{ascending:false}).order("id").range((page-1)*20,page*20-1);
  if(error)throw new VisitStoreError(error.code);
  return {visits:data??[],total:count??0};
}
export async function getVisit(client: SupabaseClient<Database>, groupId: string, visitId: string): Promise<SavedVisit|null> {
  const {data,error}=await client.from("visits").select(columns).eq("group_id",groupId).eq("id",visitId).maybeSingle();
  if(error)throw new VisitStoreError(error.code);return data;
}
export async function recordVisit(client: SupabaseClient<Database>, input: ReturnType<typeof recordVisitInput>): Promise<string> {
  const {data,error}=await client.rpc("record_visit",{p_group_id:input.groupId,p_item_id:input.itemId,p_outing_id:input.outingId,p_visited_on:input.date,p_note:input.note,p_rating:input.rating,p_request_id:input.visitId});
  if(error||!data)throw new VisitStoreError(error?.code);return data;
}
export async function getVisitRatings(client: SupabaseClient<Database>,groupId:string,visitId:string):Promise<VisitRatings>{
  const {data,error}=await client.rpc("get_visit_ratings",{p_group_id:groupId,p_visit_id:visitId});
  const row=data?.[0];
  if(error||!row||!Number.isSafeInteger(row.rating_count)||row.rating_count<0||
    (row.average_rating!==null&&(typeof row.average_rating!=="number"||row.average_rating<1||row.average_rating>5))||
    (row.my_rating!==null&&(!Number.isInteger(row.my_rating)||row.my_rating<1||row.my_rating>5)))throw new VisitStoreError(error?.code);
  return row;
}
export async function listVisitPhotos(client:SupabaseClient<Database>,groupId:string,visitId:string):Promise<VisitPhoto[]>{
  const {data,error}=await client.from("visit_photos").select("id,group_id,visit_id,slot,object_path,content_type,byte_size,status,created_at").eq("group_id",groupId).eq("visit_id",visitId).order("slot");
  if(error)throw new VisitStoreError(error.code);return data??[];
}
