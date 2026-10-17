"use client";

import { useActionState, useState } from "react";
import { issueInviteAction, revokeInviteAction } from "@/app/app/groups/invite-actions";
import { INVITE_PATH } from "@/lib/groups/invite-cookie";
import type { InviteState, InviteSummary } from "@/lib/groups/invitations";

const initial: InviteState = { error: null };
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-full bg-orange-700 px-5 text-sm font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60";
function expiry(value: string) {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

function RevokeInvite({ groupId, invite, current }: { groupId: string; invite: InviteSummary; current: boolean }) {
  const [state, action, pending] = useActionState(revokeInviteAction, initial);
  return <li className="space-y-2 rounded-2xl border border-stone-200 p-4">
    <p className="text-sm font-semibold">{current ? "今回発行した招待" : `発行日時：${expiry(invite.created_at)}（日本時間）`}</p>
    <p className="text-sm">有効期限：{expiry(invite.expires_at)}（日本時間）</p>
    {invite.revoked_at || state.success ? <p className="text-sm text-stone-500">無効化済み</p> : (
      <form action={action} aria-busy={pending}>
        <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="inviteId" value={invite.id} />
        <button disabled={pending} className="min-h-11 text-sm font-semibold text-orange-800 underline underline-offset-4 disabled:opacity-60">{pending ? "無効化中…" : "この招待を無効にする"}</button>
      </form>
    )}
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
  </li>;
}

export function InviteManagement({ groupId, invites }: { groupId: string; invites: InviteSummary[] }) {
  const [state, action, pending] = useActionState(issueInviteAction, initial);
  const [copyMessage, setCopyMessage] = useState("");
  const link = state.token && typeof window !== "undefined" ? `${window.location.origin}${INVITE_PATH}#${state.token}` : "";
  return <section aria-labelledby="invite-heading" className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
    <div><h2 id="invite-heading" className="text-xl font-semibold">仲間を招待する</h2><p className="mt-2 text-sm leading-6 text-stone-600">同じリンクで複数人が参加できます。期限は発行から7日間です。参加メンバー全員が招待を発行・無効化できます。</p></div>
    <form action={action} aria-busy={pending} onSubmit={() => setCopyMessage("")}>
      <input type="hidden" name="groupId" value={groupId} />
      <button disabled={pending} className={buttonClass}>{pending ? "発行中…" : "招待リンクを発行"}</button>
    </form>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {link && <div className="space-y-3 rounded-2xl bg-orange-50 p-4">
      <label htmlFor="invite-link" className="block text-sm font-semibold">発行した招待リンク</label>
      <input id="invite-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="min-h-11 w-full rounded-xl border border-orange-200 bg-white px-3 text-sm" />
      <p className="text-xs leading-5 text-stone-600">有効期限：{expiry(state.expiresAt!)}（日本時間）。このリンクを参加してほしい相手に送ってください。リンクの表示はこの画面を離れるまでです。</p>
      <button type="button" className={buttonClass} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopyMessage("招待リンクをコピーしました。"); } catch { setCopyMessage("リンク欄を選択してコピーしてください。"); } }}>リンクをコピー</button>
      <p role="status" className="text-sm">{copyMessage}</p>
    </div>}
    {invites.length > 0 && <div className="space-y-3"><h3 className="font-semibold">このグループの招待</h3><ul className="space-y-3">{invites.map((invite) => <RevokeInvite key={invite.id} groupId={groupId} invite={invite} current={invite.id === state.inviteId} />)}</ul><p className="text-xs leading-5 text-stone-500">期限切れや無効化後は参加できません。無効化しても、すでに参加した人の所属は変わりません。</p></div>}
  </section>;
}
