import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/lib/supabase/database.types";
import type {SavedVisit,VisitPhoto} from "@/lib/visits/repository";
export type SavedMemory=Database["public"]["Tables"]["memories"]["Row"];
const columns="id,group_id,outing_id,title,memory_date,note,revision,created_at";
export class MemoryStoreError extends Error{
  constructor(code?:string){super(code==="40001"?"別の画面で変更されました。入力を控えてから再読み込みしてください。":"思い出を読み書きできませんでした。所属や通信状態をご確認のうえ、もう一度お試しください。");this.name="MemoryStoreError";}
}
export async function listMemories(client:SupabaseClient<Database>,groupId:string,page=1){
  const {data,error,count}=await client.from("memories").select(columns,{count:"exact"}).eq("group_id",groupId).order("memory_date",{ascending:false}).order("created_at",{ascending:false}).order("id").range((page-1)*20,page*20-1);
  if(error)throw new MemoryStoreError(error.code);return {memories:data??[],total:count??0};
}
export async function getMemory(client:SupabaseClient<Database>,groupId:string,memoryId:string):Promise<SavedMemory|null>{
  const {data,error}=await client.from("memories").select(columns).eq("group_id",groupId).eq("id",memoryId).maybeSingle();
  if(error)throw new MemoryStoreError(error.code);return data;
}
export async function getMemoryContent(client:SupabaseClient<Database>,memory:SavedMemory){
  const visits:SavedVisit[]=[];
  for(let start=0;;start+=1000){
    if(start>=10000)throw new MemoryStoreError();
    const {data,error}=await client.from("visits").select("id,group_id,item_id,outing_id,item_title,visited_on,visited_time,visited_period,note,revision,created_at").eq("group_id",memory.group_id).eq("outing_id",memory.outing_id).order("id").range(start,start+999);
    if(error)throw new MemoryStoreError(error.code);visits.push(...(data??[]));if((data?.length??0)<1000)break;
  }
  // Read only ready photos for these visits, in bounded batches. Storage still authenticates each download.
  const photos:VisitPhoto[]=[];
  for(let start=0;start<visits.length;start+=100){
    const {data,error}=await client.from("visit_photos").select("id,group_id,visit_id,slot,object_path,content_type,byte_size,status,created_at").eq("group_id",memory.group_id).eq("status","ready").in("visit_id",visits.slice(start,start+100).map(v=>v.id)).order("created_at").order("id").range(0,999);
    if(error)throw new MemoryStoreError(error.code);photos.push(...(data??[]));
  }
  return {visits,photos};
}
