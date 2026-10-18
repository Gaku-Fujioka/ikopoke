"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {hasEnvVars} from "@/lib/utils";
import {memoryContext,memoryFields} from "@/lib/memories/validation";
import {MemoryStoreError} from "@/lib/memories/repository";
export type MemoryActionState={error:string|null;savedRevision?:number;savedTitle?:string;savedNote?:string};
async function authenticatedClient(){
  if(!hasEnvVars)throw new MemoryStoreError();
  const client=await createClient();const {data,error}=await client.auth.getClaims();
  if(error||!data?.claims?.sub)throw new MemoryStoreError();return client;
}
const failure=(cause:unknown)=>({error:cause instanceof MemoryStoreError?cause.message:"保存できませんでした。通信状態を確認して、もう一度お試しください。"});
export async function setOutingCompletedAction(_previous:MemoryActionState,form:FormData):Promise<MemoryActionState>{
  let input,completed;
  try{input=memoryContext(form);const value=form.get("completed");if(value!=="true"&&value!=="false")throw new Error("終了操作を選び直してください。");completed=value==="true";}
  catch(cause){return {error:cause instanceof Error?cause.message:"入力をご確認ください。"};}
  let memoryId;
  try{
    const client=await authenticatedClient();const {data,error}=await client.rpc("set_outing_completed",{p_group_id:input.groupId,p_outing_id:input.id,p_completed:completed,p_expected_revision:input.revision});
    if(error||(completed&&!data))throw new MemoryStoreError(error?.code);memoryId=data;
  }catch(cause){return failure(cause);}
  const base=`/app/groups/${input.groupId}`;
  revalidatePath(`${base}/outings`);revalidatePath(`${base}/outings/${input.id}`);revalidatePath(`${base}/outings/calendar`);revalidatePath(`${base}/memories`);
  if(memoryId)revalidatePath(`${base}/memories/${memoryId}`);
  redirect(completed?`${base}/memories/${memoryId}`:`${base}/outings/${input.id}`);
}
export async function updateMemoryAction(_previous:MemoryActionState,form:FormData):Promise<MemoryActionState>{
  let input;
  try{input={...memoryContext(form),...memoryFields(form)};}catch(cause){return {error:cause instanceof Error?cause.message:"入力をご確認ください。"};}
  try{
    const client=await authenticatedClient();const {data,error}=await client.rpc("update_memory",{p_group_id:input.groupId,p_memory_id:input.id,p_expected_revision:input.revision,p_title:input.title,p_note:input.note});
    if(error||typeof data!=="number")throw new MemoryStoreError(error?.code);
    revalidatePath(`/app/groups/${input.groupId}/memories`);revalidatePath(`/app/groups/${input.groupId}/memories/${input.id}`);
    return {error:null,savedRevision:data,savedTitle:input.title,savedNote:input.note};
  }catch(cause){return failure(cause);}
}
