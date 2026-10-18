"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { createGroup, GroupStoreError } from "@/lib/groups/repository";
import { isGroupId, parseGroupInput } from "@/lib/groups/validation";

export type GroupCreationState = {error:string|null;fieldError?:boolean;groupId?:string};

/** Returns the saved group for the browser's optional photo step, without redirecting early. */
export async function createGroupProfileAction(formData:FormData):Promise<GroupCreationState> {
  if (!hasEnvVars) return {error:"グループ機能は準備中です。"};
  let input;
  try { input=parseGroupInput(formData.get("name"),formData.get("requestId")); }
  catch(error){return {error:error instanceof Error?error.message:"入力内容をご確認ください。",fieldError:true};}
  const description=formData.get("description")??"";
  if(typeof description!=="string"||Array.from(description).length>500)return {error:"説明は500文字以内で入力してください。"};
  try {
    const client=await createClient(),auth=await client.auth.getClaims();
    if(auth.error||!auth.data?.claims?.sub)return {error:"ログインし直して、もう一度お試しください。"};
    const {data,error}=await client.rpc("create_group_with_profile",{p_name:input.name,p_request_id:input.requestId,p_description:description.trim()});
    if(error)throw new GroupStoreError(error);
    if(!isGroupId(data))throw new GroupStoreError(null);
    revalidatePath("/app/groups");revalidatePath("/app");
    return {error:null,groupId:data};
  }catch(error){return {error:error instanceof GroupStoreError?error.message:"グループを保存できませんでした。もう一度お試しください。"};}
}

export async function createGroupAction(_previous: { error: string | null }, formData: FormData): Promise<{ error: string | null; fieldError?: boolean }> {
  if (!hasEnvVars) return { error: "グループ機能は準備中です。" };
  let input;
  try {
    input = parseGroupInput(formData.get("name"), formData.get("requestId"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "入力内容をご確認ください。", fieldError: true };
  }

  let groupId;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直して、もう一度お試しください。" };
    groupId = await createGroup(client, input);
  } catch (error) {
    return { error: error instanceof GroupStoreError ? error.message : "グループを保存できませんでした。もう一度お試しください。" };
  }
  revalidatePath("/app/groups");
  revalidatePath("/app");
  redirect(`/app/groups/${encodeURIComponent(groupId)}`);
}
