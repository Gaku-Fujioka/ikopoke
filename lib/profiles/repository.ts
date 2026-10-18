import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {isProfilePath} from "@/lib/presentation/colors";

export type GroupMember = { user_id: string; display_name: string | null; avatar_path?:string };

export class ProfileStoreError extends Error {
  constructor() {
    super("表示名を読み書きできませんでした。通信状態をご確認のうえ、もう一度お試しください。");
    this.name = "ProfileStoreError";
  }
}

export async function getMyProfile(client: SupabaseClient<Database>, userId: string): Promise<string | null> {
  const { data, error } = await client.from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
  if (error) throw new ProfileStoreError();
  return data?.display_name ?? null;
}

export async function setMyDisplayName(client: SupabaseClient<Database>, name: string): Promise<void> {
  const { error } = await client.rpc("set_my_display_name", { p_name: name });
  if (error) throw new ProfileStoreError();
}

export async function getGroupMembers(client: SupabaseClient<Database>, groupId: string): Promise<GroupMember[]> {
  const { data, error } = await client.rpc("get_group_members", { p_group_id: groupId });
  if (error) throw new ProfileStoreError();
  try {
    const photos=await client.rpc("get_member_avatars",{p_group:groupId});
    return (data ?? []).map(member=>{const photo=photos.data?.find(row=>row.user_id===member.user_id&&isProfilePath(row.path));return photo?{...member,avatar_path:photo.path}:member;});
  } catch { return data ?? []; } // Optional photos must not block participant selection.
}
