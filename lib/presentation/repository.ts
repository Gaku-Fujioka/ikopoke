import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isGroupColor, isProfilePath, type GroupColor } from "@/lib/presentation/colors";

export type GroupPresentation = { group_id: string; description: string; cover_id: string | null; cover_path: string | null; revision: number; color: GroupColor | null };
export type MediaEditor = { id: string | null; path: string | null; unused: { id: string; status: string; can_publish: boolean }[] };
export class PresentationError extends Error {
  constructor(code?: string) {
    super(code === "40001" ? "別の画面で変更されています。入力を控え、再読み込みしてからお試しください。" : ["42P01", "PGRST202"].includes(code ?? "") ? "プロフィール機能は準備中です。" : "プロフィールを保存できませんでした。通信を確認し、未完了の写真があれば確認・整理してください。");
  }
}
export async function getGroupPresentations(client: SupabaseClient<Database>, ids: string[]): Promise<GroupPresentation[]> {
  if (!ids.length) return [];
  const {data,error} = await client.rpc("get_group_presentations", {p_ids:ids});
  if (error || !Array.isArray(data)) throw new PresentationError(error?.code);
  return data.map(row => {
    if (!ids.includes(row.group_id) || typeof row.description !== "string" || (row.color !== null && !isGroupColor(row.color)) || (row.cover_path !== null && !isProfilePath(row.cover_path))) throw new PresentationError();
    return {...row,color:row.color as GroupColor | null};
  });
}
export async function getMediaEditor(client: SupabaseClient<Database>, group: string | null): Promise<MediaEditor> {
  const {data,error} = await client.rpc("get_profile_editor", {p_group:group});
  if (error || !data || (data.path !== null && !isProfilePath(data.path)) || !Array.isArray(data.unused)) throw new PresentationError(error?.code);
  return data;
}
export async function socialAvatars(client: SupabaseClient<Database>, group: string, keys: string[], comments = false): Promise<Record<string,string>> {
 try{
  const {data,error} = await client.rpc("get_social_avatars",{p_group:group,p_keys:keys,p_comments:comments});
  // Auxiliary photos never block the existing conversation or activity content.
  if (error || !Array.isArray(data)) return {};
  return Object.fromEntries(data.filter(row=>keys.includes(row.key)&&isProfilePath(row.path)).map(row=>[row.key,row.path]));
 }catch{return {};}
}
