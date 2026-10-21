import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { recordVisitInput } from "./validation";
export type SavedVisit = Omit<Database["public"]["Tables"]["visits"]["Row"],"created_by">;
export type VisitPhoto = Omit<Database["public"]["Tables"]["visit_photos"]["Row"],"created_by" | "deletion_actor" | "memory_page_id">;
export type VisitRatings = { rating_count: number; average_rating: number | null; my_rating: number | null };
const columns="id,group_id,item_id,outing_id,item_title,visited_on,visited_time,visited_period,note,revision,created_at,deleting,outing_stop_id";
export class VisitStoreError extends Error {
  constructor(code?: string) {
    super(code==="40001" ? "この記録は別の画面で変更されました。入力を控えてから再読み込みしてください。" : code==="54000" ? "写真は1回の訪問につき10枚までです。未完了の送信がある場合は、確認か中断をしてください。" : "訪問記録を読み書きできませんでした。所属や通信状態をご確認のうえ、もう一度お試しください。");
    this.name="VisitStoreError";
  }
}
export async function listVisits(client: SupabaseClient<Database>, groupId: string|null, page=1, filter?: { itemId?: string; outingId?: string }): Promise<{ visits: SavedVisit[]; total: number }> {
  let query=client.from("visits").select(columns,{count:"exact"});
  if(groupId)query=query.eq("group_id",groupId);
  if (filter?.itemId) query=query.eq("item_id",filter.itemId);
  if (filter?.outingId) query=query.eq("outing_id",filter.outingId);
  const {data,error,count}=await query.order("visited_on",{ascending:false}).order("created_at",{ascending:false}).order("id").range((page-1)*20,page*20-1);
  if(error)throw new VisitStoreError(error.code);
  return {visits:data??[],total:count??0};
}
export type VisitSummary=SavedVisit & {photoCount:number|null;preview?:{object_path:string;content_type:string}};
/** The caller's session/RLS scopes visits; fetch only ready photos for this page (max 20 × 10). */
export async function listVisitSummaries(client:SupabaseClient<Database>,groupId:string|null,page=1,filter?:{itemId?:string;outingId?:string}):Promise<{visits:VisitSummary[];total:number;photosUnavailable:boolean}>{
  const result=await listVisits(client,groupId,page,filter);
  if(!result.visits.length)return {...result,visits:[],photosUnavailable:false};
  const query=client.from("visit_photos").select("group_id,visit_id,object_path,content_type").in("group_id",[...new Set(result.visits.map(visit=>visit.group_id))]).in("visit_id",result.visits.map(visit=>visit.id)).eq("status","ready").order("display_order").order("id").limit(200);
  try{
    const {data,error}=await query;
    if(error)throw new VisitStoreError(error.code);
    return {...result,photosUnavailable:false,visits:result.visits.map(visit=>{
      const photos=(data??[]).filter(photo=>photo.group_id===visit.group_id&&photo.visit_id===visit.id);
      return {...visit,photoCount:photos.length,preview:photos[0]?{object_path:photos[0].object_path,content_type:photos[0].content_type}:undefined};
    })};
  }catch{
    return {...result,photosUnavailable:true,visits:result.visits.map(visit=>({...visit,photoCount:null}))};
  }
}
export async function getVisit(client: SupabaseClient<Database>, groupId: string, visitId: string): Promise<SavedVisit|null> {
  const {data,error}=await client.from("visits").select(columns).eq("group_id",groupId).eq("id",visitId).maybeSingle();
  if(error)throw new VisitStoreError(error.code);return data;
}
export async function recordVisit(client: SupabaseClient<Database>, input: ReturnType<typeof recordVisitInput>): Promise<string> {
  const {data,error}=await client.rpc(input.stopId ? "record_stop_visit" : "record_timed_visit",{p_group_id:input.groupId,p_item_id:input.itemId,p_outing_id:input.outingId,p_visited_on:input.date,p_note:input.note,p_rating:input.rating,p_request_id:input.visitId,p_time:input.time,p_period:input.period,...(input.stopId ? {p_stop_id:input.stopId} : {})});
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
  const {data,error}=await client.from("visit_photos").select("id,group_id,visit_id,slot,display_order,object_path,content_type,byte_size,status,created_at").eq("group_id",groupId).eq("visit_id",visitId).order("display_order").order("id");
  if(error)throw new VisitStoreError(error.code);return data??[];
}
