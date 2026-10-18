"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isGroupId } from "@/lib/groups/validation";
type State={error:string|null};
export async function leaveGroupAction(_previous:State,form:FormData):Promise<State>{
  const group=form.get("groupId"),count=Number(form.get("memberCount"));
  if(!isGroupId(group)||!Number.isSafeInteger(count)||count<1||form.get("confirm")!=="yes"||(count===1&&form.get("deleteLast")!=="yes"))return {error:"退出する内容を確認してください。"};
  try{
    const client=await createClient(),auth=await client.auth.getUser();if(auth.error||!auth.data.user)return {error:"ログインし直してください。"};
    const begin=await client.rpc("begin_leave_group",{p_group_id:group,p_expected_members:count,p_delete_last:count===1});
    if(begin.error)return {error:begin.error.code==="40001"?"メンバー数が変わっています。再読み込みして退出する内容を確認してください。":"退出を始められませんでした。通信状態を確認し、もう一度お試しください。"};
    if(begin.data){
      for(let batch=0;batch<20;batch++){
        const paths=await client.rpc("get_group_cleanup_paths",{p_group_id:group});if(paths.error||!Array.isArray(paths.data))throw new Error();
        if(!paths.data.length)break;
        const removed=await client.storage.from("visit-photos").remove(paths.data.map(p=>p.object_path));if(removed.error)throw new Error();
      }
      const end=await client.rpc("finish_leave_group",{p_group_id:group});if(end.error)throw new Error();
    }
  }catch{return {error:"退出処理が完了していません。グループ設定のこの画面から再試行してください。削除開始後は新しい投稿・参加を受け付けません。"};}
  revalidatePath("/app","layout");redirect("/app");
}
