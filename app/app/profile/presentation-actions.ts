"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {isGroupId} from "@/lib/groups/validation";
import {isGroupColor,isProfilePath} from "@/lib/presentation/colors";
import {PresentationError} from "@/lib/presentation/repository";

export type PresentationState={error:string|null;saved?:boolean;id?:string|null;path?:string;status?:string};
const failure=(code?:string):PresentationState=>({error:new PresentationError(code).message});
export async function saveGroupPresentationAction(_previous:PresentationState,form:FormData):Promise<PresentationState>{
 const group=form.get("groupId"),mode=form.get("mode"),color=form.get("color"),description=form.get("description"),revision=Number(form.get("revision"));
 if(!isGroupId(group)||(mode!=="color"&&mode!=="description"))return failure("22023");
 if(mode==="color"&&!isGroupColor(color))return {error:"表示色を選んでください。"};
 if(mode==="description"&&(typeof description!=="string"||Array.from(description).length>500||!Number.isSafeInteger(revision)||revision<1))return {error:"説明は500文字以内で入力してください。"};
 try{
  const client=await createClient(),auth=await client.auth.getClaims();if(auth.error||!auth.data?.claims?.sub)return {error:"ログインし直してください。"};
  const {error}=await client.rpc("save_group_presentation",{p_group:group,p_description:mode==="description"?description as string:null,p_expected:mode==="description"?revision:null,p_color:mode==="color"?color as string:null});
  if(error)return failure(error.code);
 }catch{return failure();}
 revalidatePath("/app","layout");return {error:null,saved:true};
}
export async function profileMediaAction(form:FormData):Promise<PresentationState>{
 const mode=form.get("operation"),kind=form.get("kind"),group=form.get("groupId")||null,id=form.get("mediaId")||null,expected=form.get("expectedId")||null,size=Number(form.get("byteSize"));
 if(typeof mode!=="string"||!["reserve","publish","detach","discard","forget"].includes(mode)||!["cover","avatar"].includes(String(kind))||(kind==="cover"?!isGroupId(group):group!==null)||(mode!=="detach"&&!isGroupId(id))||(expected!==null&&!isGroupId(expected))||(mode==="reserve"&&(!Number.isSafeInteger(size)||size<1||size>2097152)))return failure("22023");
 try{
  const client=await createClient(),auth=await client.auth.getClaims();if(auth.error||!auth.data?.claims?.sub)return {error:"ログインし直してください。"};
  const {data,error}=await client.rpc("edit_profile_media",{p_action:mode,p_kind:kind as string,p_group:group as string|null,p_id:id as string|null,p_expected:expected as string|null,p_size:mode==="reserve"?size:null});
  if(error)return failure(error.code);
  if(data?.path&&!isProfilePath(data.path))return failure();
  if(["publish","detach","forget"].includes(mode))revalidatePath("/app","layout");
  return {error:null,...data};
 }catch{return failure();}
}
