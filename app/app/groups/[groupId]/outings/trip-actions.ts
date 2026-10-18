"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateSharedHome } from "@/lib/home/revalidate";
import { selectedCandidateIds } from "@/lib/outings/selection";
import { parseTrip } from "@/lib/outings/trips";
import { isGroupId } from "@/lib/groups/validation";
type State={error:string|null;saved?:boolean;redirectTo?:string};
function refresh(group:string,id:string){revalidatePath(`/app/groups/${group}/outings`);revalidatePath(`/app/groups/${group}/outings/calendar`);revalidatePath(`/app/groups/${group}/outings/${id}`);revalidatePath("/app/groups/[groupId]/memories/[memoryId]","page");revalidateSharedHome(group,"outings");}
export async function saveTripAction(_previous:State,form:FormData):Promise<State>{
  let input;try{input=parseTrip(form);}catch(cause){return {error:cause instanceof Error?cause.message:"入力をご確認ください。"};}
  try{
    const client=await createClient(),auth=await client.auth.getClaims();if(auth.error||!auth.data?.claims?.sub)return {error:"ログインし直してください。"};
    const {error}=await client.rpc("save_trip",{p_group_id:input.groupId,p_outing_id:input.outingId,p_expected_revision:input.expectedRevision,p_title:input.title,p_start:input.start,p_end:input.end,p_memo:input.memo,p_days:input.days,p_participants:input.participants,p_removed_ids:input.removedIds});
    if(error)return {error:error.code==="40001"?"ほかの画面で変更されています。入力を控えて再読み込みしてください。":error.code==="22023"?"日ごとの参加者・時間と旅行期間をご確認ください。期間外の行き先は先に移すか外してください。中止・終了済みの計画は再開してから編集できます。":"計画を保存できませんでした。所属と候補の状態をご確認ください。"};
  }catch{return {error:"計画を保存できませんでした。もう一度お試しください。"};}
  const selected = selectedCandidateIds(form.get("selectedIds"));
  refresh(input.groupId,input.outingId);
  const href = `/app/groups/${input.groupId}/outings/${input.outingId}`;
  if (selected.length) return {error:null,redirectTo:href+"?planned="+encodeURIComponent(selected.join(","))};
  redirect(href);
}
export async function cancelOutingAction(_previous:State,form:FormData):Promise<State>{
  const group=form.get('groupId'),id=form.get('outingId'),cancelled=form.get('cancelled'),revision=Number(form.get('revision'));
  if(!isGroupId(group)||!isGroupId(id)||!['0','1'].includes(String(cancelled))||!Number.isSafeInteger(revision)||revision<1||form.get('confirm')!=='yes')return {error:"計画と操作の確認をしてください。"};
  try{const client=await createClient();const auth=await client.auth.getClaims();if(auth.error||!auth.data?.claims?.sub)return {error:"ログインし直してください。"};const {error}=await client.rpc('set_outing_cancelled',{p_group_id:group,p_outing_id:id,p_cancelled:cancelled==='1',p_expected_revision:revision});if(error)return {error:error.code==='40001'?"ほかの画面で変更されています。再読み込みしてください。":"変更できませんでした。終了済みの場合は先に終了を取り消してください。"};refresh(group,id);return {error:null,saved:true};}catch{return {error:"変更できませんでした。もう一度お試しください。"};}
}
