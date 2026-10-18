"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isGroupId } from "@/lib/groups/validation";
export async function deleteMyAccountAction(_previous:{error:string|null},form:FormData):Promise<{error:string|null}>{
  const requestId=form.get("requestId"),password=form.get("password");
  if(!isGroupId(requestId)||typeof password!=="string"||!password||password.length>4096||form.get("confirm")!=="yes")return {error:"現在のパスワードと削除する内容を確認してください。"};
  let groupIds:unknown,deleteGroupIds:unknown;
  try{groupIds=JSON.parse(String(form.get("groupIds")));deleteGroupIds=JSON.parse(String(form.get("deleteGroupIds")));}catch{return {error:"画面を開き直してください。"};}
  if(!Array.isArray(groupIds)||!Array.isArray(deleteGroupIds)||groupIds.length>1000||deleteGroupIds.length>1000||!groupIds.every(isGroupId)||!deleteGroupIds.every(isGroupId))return {error:"画面を開き直してください。"};
  try{
    const client=await createClient(),verified=await client.auth.getUser();
    if(verified.error||!verified.data.user?.email)return {error:"ログイン状態を確認できませんでした。削除済みの場合は完了しています。未完了の場合はログインし直して再試行してください。"};
    // Passwords never leave this server action for a function body or a log.
    const signedIn=await client.auth.signInWithPassword({email:verified.data.user.email,password});
    if(signedIn.error)return {error:"本人確認できませんでした。現在のパスワードを確認し、時間をおいて再試行してください。"};
    const result=await client.functions.invoke("delete-account",{body:{confirm:"delete-my-account",requestId,groupIds,deleteGroupIds}});
    if(result.error||result.data?.ok!==true)return {error:"削除が完了していません。メンバーが変わった場合は画面を開き直して内容を確認してください。途中まで進んだ場合も、同じ画面から再試行できます。"};
    await client.auth.signOut({scope:"local"});
  }catch{return {error:"削除が完了したか確認できませんでした。未完了ならプロフィールから再試行してください。"};}
  revalidatePath("/app","layout");redirect("/auth/login?account=deleted");
}
