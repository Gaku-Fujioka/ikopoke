"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { photoFileInput,photoInput,recordVisitInput,visitFields,visitIds,visitRating,PHOTO_BUCKET } from "@/lib/visits/validation";
import { recordVisit,VisitStoreError } from "@/lib/visits/repository";
export type VisitActionState={error:string|null;saved?:boolean;savedRevision?:number;savedDate?:string;savedNote?:string;savedTime?:string|null;savedPeriod?:string|null;savedRating?:number|null};
const message=(cause:unknown)=>cause instanceof VisitStoreError?cause.message:"保存できませんでした。通信状態をご確認のうえ、もう一度お試しください。";
async function clientForAction(){
  if(!hasEnvVars)throw new VisitStoreError();
  const client=await createClient();const {data,error}=await client.auth.getClaims();
  if(error||!data?.claims?.sub)throw new VisitStoreError();return client;
}
function refreshVisit(groupId:string,visitId:string){
  revalidatePath(`/app/groups/${groupId}/visits`);
  revalidatePath(`/app/groups/${groupId}/visits/${visitId}`);
  revalidatePath("/app/groups/[groupId]/memories/[memoryId]","page");
}
export async function recordVisitAction(_previous:VisitActionState,form:FormData):Promise<VisitActionState>{
  let input;
  try{input=recordVisitInput(form);}catch(cause){return {error:cause instanceof Error?cause.message:"入力内容をご確認ください。"};}
  let id;
  try{id=await recordVisit(await clientForAction(),input);}catch(cause){return {error:message(cause)};}
  refreshVisit(input.groupId,id);
  revalidatePath(`/app/groups/${input.groupId}/items/${input.itemId}`);
  if(input.outingId)revalidatePath(`/app/groups/${input.groupId}/outings/${input.outingId}`);
  redirect(`/app/groups/${input.groupId}/visits/${id}`);
}
export async function updateVisitAction(_previous:VisitActionState,form:FormData):Promise<VisitActionState>{
  let input;
  try{
    const revision=Number(form.get("revision"));
    if(!Number.isSafeInteger(revision)||revision<1)throw new Error("画面を開き直してください。");
    input={...visitIds(form),...visitFields(form),revision};
  }catch(cause){return {error:cause instanceof Error?cause.message:"入力内容をご確認ください。"};}
  try{
    const client=await clientForAction();const {data,error}=await client.rpc("update_timed_visit",{p_group_id:input.groupId,p_visit_id:input.visitId,p_visited_on:input.date,p_note:input.note,p_expected_revision:input.revision,p_time:input.time,p_period:input.period});
    if(error||typeof data!=="number")throw new VisitStoreError(error?.code);
    refreshVisit(input.groupId,input.visitId);return {error:null,saved:true,savedRevision:data,savedDate:input.date,savedNote:input.note,savedTime:input.time,savedPeriod:input.period};
  }catch(cause){return {error:message(cause)};}
}
export async function rateVisitAction(_previous:VisitActionState,form:FormData):Promise<VisitActionState>{
  let input;
  try{input={...visitIds(form),rating:visitRating(form.get("rating"))};}catch(cause){return {error:cause instanceof Error?cause.message:"評価をご確認ください。"};}
  try{
    const client=await clientForAction();const {error}=await client.rpc("set_visit_rating",{p_group_id:input.groupId,p_visit_id:input.visitId,p_value:input.rating});
    if(error)throw new VisitStoreError(error.code);refreshVisit(input.groupId,input.visitId);return {error:null,saved:true,savedRating:input.rating};
  }catch(cause){return {error:message(cause)};}
}
export async function reservePhotoAction(form:FormData){
  let input;
  try{input={...photoInput(form),...photoFileInput(form.get("contentType"),Number(form.get("byteSize")))};}
  catch(cause){return {error:cause instanceof Error?cause.message:"写真を選び直してください。"};}
  try{
    const client=await clientForAction();const {data,error}=await client.rpc("reserve_visit_photo",{p_group_id:input.groupId,p_visit_id:input.visitId,p_request_id:input.photoId,p_content_type:input.contentType,p_byte_size:input.byteSize});
    if(error||!data?.[0])throw new VisitStoreError(error?.code);return {error:null,reservation:data[0]};
  }catch(cause){return {error:message(cause)};}
}
export async function finishPhotoAction(form:FormData):Promise<VisitActionState>{
  let input;
  try{input=photoInput(form);}catch{return {error:"写真の情報を確認できませんでした。画面を開き直してください。"};}
  try{
    const client=await clientForAction();const {error}=await client.rpc("finish_visit_photo",{p_group_id:input.groupId,p_visit_id:input.visitId,p_photo_id:input.photoId});
    if(error)throw new VisitStoreError(error.code);refreshVisit(input.groupId,input.visitId);return {error:null,saved:true};
  }catch{return {error:"写真の送信完了を確認できませんでした。再試行するか、未完了の送信を中断してください。"};}
}
export async function cancelPhotoAction(form:FormData):Promise<VisitActionState>{
  let input;
  try{input=photoInput(form);}catch{return {error:"写真の情報を確認できませんでした。"};}
  try{
    const client=await clientForAction();
    const {data:path,error:beginError}=await client.rpc("begin_cancel_visit_photo",{p_group_id:input.groupId,p_visit_id:input.visitId,p_photo_id:input.photoId});
    if(beginError||!path)throw new VisitStoreError(beginError?.code);
    // A missing object or a lost delete response can still be complete. The
    // following RPC verifies absence before it may release the reservation.
    try{await client.storage.from(PHOTO_BUCKET).remove([path]);}catch{}
    const {error}=await client.rpc("cancel_visit_photo",{p_group_id:input.groupId,p_visit_id:input.visitId,p_photo_id:input.photoId});
    if(error)throw new VisitStoreError(error.code);return {error:null,saved:true};
  }catch{return {error:"写真の中断が完了していません。再試行してください。訪問記録は保存されています。"};}
  finally{refreshVisit(input.groupId,input.visitId);}
}
