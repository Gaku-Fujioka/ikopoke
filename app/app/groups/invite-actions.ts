"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { isGroupId } from "@/lib/groups/validation";
import { INVITE_COOKIE, inviteCookieOptions, isInviteToken } from "@/lib/groups/invite-cookie";
import { acceptInvite, InviteError, issueInvite, previewInvite, revokeInvite, type InviteState } from "@/lib/groups/invitations";

function failure(error: unknown): InviteState {
  return { error: error instanceof InviteError ? error.message : "招待を処理できませんでした。もう一度お試しください。" };
}

async function authenticatedClient() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  return error || !data?.claims?.sub ? null : client;
}

export async function issueInviteAction(_previous: InviteState, form: FormData): Promise<InviteState> {
  if (!hasEnvVars) return { error: "招待機能は準備中です。" };
  const groupId = form.get("groupId");
  if (!isGroupId(groupId)) return { error: "グループを開き直してください。" };
  try {
    const client = await authenticatedClient();
    if (!client) return { error: "ログインし直してください。" };
    const token = randomBytes(32).toString("hex");
    const issued = await issueInvite(client, groupId, createHash("sha256").update(token).digest("hex"));
    revalidatePath(`/app/groups/${groupId}/settings`);
    return { error: null, token, inviteId: issued.id, expiresAt: issued.expires_at };
  } catch (error) { return failure(error); }
}

export async function revokeInviteAction(_previous: InviteState, form: FormData): Promise<InviteState> {
  if (!hasEnvVars) return { error: "招待機能は準備中です。" };
  const groupId = form.get("groupId"), inviteId = form.get("inviteId");
  if (!isGroupId(groupId) || !isGroupId(inviteId)) return { error: "グループを開き直してください。" };
  try {
    const client = await authenticatedClient();
    if (!client) return { error: "ログインし直してください。" };
    await revokeInvite(client, inviteId);
    revalidatePath(`/app/groups/${groupId}/settings`);
    return { error: null, success: true };
  } catch (error) { return failure(error); }
}

// Store the fragment token without putting it into request URLs or auth redirects.
export async function previewInviteAction(_previous: InviteState, form: FormData): Promise<InviteState> {
  if (!hasEnvVars) return { error: "招待機能は準備中です。" };
  try {
    const jar = await cookies();
    const supplied = form.get("token");
    const token = supplied === null ? jar.get(INVITE_COOKIE)?.value : supplied;
    if (!isInviteToken(token)) return { error: "招待リンクを送り主から開き直してください。" };
    const client = await authenticatedClient();
    jar.set(INVITE_COOKIE, token, inviteCookieOptions());
    if (!client) return { error: null, needLogin: true };
    return { error: null, preview: await previewInvite(client, token) };
  } catch (error) { return failure(error); }
}

export async function acceptInviteAction(_previous: InviteState, form: FormData): Promise<InviteState> {
  if (!hasEnvVars) return { error: "招待機能は準備中です。" };
  const expectedGroupId = form.get("groupId");
  if (!isGroupId(expectedGroupId)) return { error: "招待内容をもう一度確認してください。" };
  let groupId;
  try {
    const client = await authenticatedClient();
    if (!client) return { error: "ログインし直して、招待内容をご確認ください。" };
    const jar = await cookies();
    const token = jar.get(INVITE_COOKIE)?.value;
    if (!isInviteToken(token)) return { error: "招待リンクを開き直してください。" };
    groupId = await acceptInvite(client, token, expectedGroupId);
    jar.set(INVITE_COOKIE, "", { ...inviteCookieOptions(), maxAge: 0 });
  } catch (error) { return failure(error); }
  revalidatePath("/app/groups");
  revalidatePath("/app");
  revalidatePath(`/app/groups/${groupId}`);
  redirect(`/app/groups/${encodeURIComponent(groupId)}`);
}
