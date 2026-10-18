import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isGroupId } from "@/lib/groups/validation";
export type DepartureGroup={group_id:string;name:string;member_count:number;deleting:boolean};
export type DeletionJob={request_id:string;state:string;group_ids:string[];delete_group_ids:string[]};
export async function myDepartures(client:SupabaseClient<Database>):Promise<DepartureGroup[]>{
  const {data,error}=await client.rpc("get_my_group_departures");
  if(error||!Array.isArray(data)||data.length>1000||data.some(g=>!isGroupId(g.group_id)||typeof g.name!=="string"||!Number.isSafeInteger(g.member_count)||g.member_count<1||typeof g.deleting!=="boolean"))throw new Error("退出の情報を読み込めませんでした。再読み込みしてください。");
  return data.map(g=>({group_id:g.group_id,name:g.name,member_count:g.member_count,deleting:g.deleting}));
}
export async function myDeletionJob(client:SupabaseClient<Database>):Promise<DeletionJob|null>{
  const {data,error}=await client.rpc("get_my_account_deletion");if(error||!Array.isArray(data)||data.length>1)throw new Error("削除の状態を確認できませんでした。再読み込みしてください。");
  const job=data[0];if(!job)return null;
  if(!isGroupId(job.request_id)||!["pending","data_removed","complete"].includes(job.state)||!Array.isArray(job.group_ids)||!job.group_ids.every(isGroupId)||!Array.isArray(job.delete_group_ids)||!job.delete_group_ids.every(isGroupId))throw new Error("削除の状態を確認できませんでした。");
  return {request_id:job.request_id,state:job.state,group_ids:job.group_ids,delete_group_ids:job.delete_group_ids};
}
