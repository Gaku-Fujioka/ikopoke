import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";

export type InviteSummary = Pick<Database["public"]["Tables"]["group_invites"]["Row"], "id" | "created_at" | "expires_at" | "revoked_at">;
export type InvitePreview = { group_id: string; group_name: string; expires_at: string };
export type InviteState = { error: string | null; needLogin?: boolean; preview?: InvitePreview; token?: string; inviteId?: string; expiresAt?: string; success?: boolean };

export class InviteError extends Error {
  constructor(error: { code?: string } | null) {
    super(error && ["42P01", "PGRST202", "PGRST205"].includes(error.code ?? "")
      ? "招待機能は準備中です。利用できるようになるまでお待ちください。"
      : error?.code === "P0001"
        ? "この招待は利用できません。有効期限や無効化の状態を送り主にご確認ください。"
        : "招待を読み書きできませんでした。ログイン状態や通信状態をご確認ください。");
    this.name = "InviteError";
  }
}

export async function listInvites(client: SupabaseClient<Database>, groupId: string): Promise<InviteSummary[]> {
  const { data, error } = await client.from("group_invites").select("id,created_at,expires_at,revoked_at").eq("group_id", groupId).order("created_at", { ascending: false });
  if (error) throw new InviteError(error);
  return data ?? [];
}

export async function issueInvite(client: SupabaseClient<Database>, groupId: string, tokenHash: string) {
  const { data, error } = await client.rpc("create_group_invite", { p_group_id: groupId, p_token_hash: tokenHash });
  if (error || !data?.[0]) throw new InviteError(error);
  return data[0];
}

export async function previewInvite(client: SupabaseClient<Database>, token: string): Promise<InvitePreview> {
  const { data, error } = await client.rpc("preview_group_invite", { p_token: token });
  if (error || !data?.[0]) throw new InviteError(error);
  return data[0];
}

export async function acceptInvite(client: SupabaseClient<Database>, token: string, groupId: string): Promise<string> {
  const { data, error } = await client.rpc("accept_group_invite", { p_token: token, p_group_id: groupId });
  if (error || !data) throw new InviteError(error);
  return data;
}

export async function revokeInvite(client: SupabaseClient<Database>, inviteId: string) {
  const { error } = await client.rpc("revoke_group_invite", { p_invite_id: inviteId });
  if (error) throw new InviteError(error);
}
