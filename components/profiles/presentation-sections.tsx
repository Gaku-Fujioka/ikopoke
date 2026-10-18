import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/lib/supabase/database.types";
import {getGroupPresentations,getMediaEditor,PresentationError} from "@/lib/presentation/repository";
import {GroupPresentationForm,ProfilePhotoEditor} from "./presentation-forms";

export async function GroupProfileSection({client,groupId}:{client:SupabaseClient<Database>;groupId:string}){
 try{const [rows,editor]=await Promise.all([getGroupPresentations(client,[groupId]),getMediaEditor(client,groupId)]);if(!rows[0])throw new PresentationError();
  return <div className="space-y-6"><GroupPresentationForm groupId={groupId} presentation={rows[0]}/><ProfilePhotoEditor groupId={groupId} editor={editor}/></div>;
 }catch(cause){return <p role="status" className="kk-notice">{cause instanceof PresentationError?cause.message:"グループのプロフィールを読み込めませんでした。再読み込みしてください。"}</p>;}
}
export async function MyPhotoSection({client}:{client:SupabaseClient<Database>}){
 try{return <ProfilePhotoEditor editor={await getMediaEditor(client,null)}/>;}
 catch(cause){return <p role="status" className="kk-notice">{cause instanceof PresentationError?cause.message:"プロフィール写真を読み込めませんでした。再読み込みしてください。"}</p>;}
}
