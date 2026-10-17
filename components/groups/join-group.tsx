"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { acceptInviteAction, previewInviteAction } from "@/app/app/groups/invite-actions";
import type { InviteState } from "@/lib/groups/invitations";
import { INVITE_PATH } from "@/lib/groups/invite-cookie";
import { authEntryPath } from "@/lib/auth/safe-next-path";

const initial: InviteState = { error: null };

export function JoinGroup() {
  const [state, previewAction, previewing] = useActionState(previewInviteAction, initial);
  const [joined, joinAction, joining] = useActionState(acceptInviteAction, initial);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const form = new FormData();
    if (window.location.hash) {
      form.set("token", window.location.hash.slice(1));
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    startTransition(() => previewAction(form));
  }, [previewAction]);

  return <section aria-labelledby="join-heading" className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
    <h1 id="join-heading" className="text-3xl font-bold">グループへの招待</h1>
    <p className="text-sm leading-6 text-stone-600">参加先を確認してから「参加する」を押してください。</p>
    {previewing && <p role="status">招待を確認しています…</p>}
    {state.needLogin && <div className="space-y-4"><p className="leading-7">招待内容を確認するにはログインしてください。登録がまだの方はアカウントを作成できます。</p><div className="flex flex-wrap gap-4"><Link href={authEntryPath("login", INVITE_PATH)} className="inline-flex min-h-12 items-center rounded-full bg-orange-700 px-6 font-semibold text-white">ログイン</Link><Link href={authEntryPath("sign-up", INVITE_PATH)} className="inline-flex min-h-12 items-center font-semibold text-orange-800 underline underline-offset-4">アカウントを作成</Link></div><p className="text-xs leading-5 text-stone-500">同じブラウザで登録・メール確認すると、この招待へ戻れます。別のブラウザを使う場合は招待リンクを開き直してください。</p></div>}
    {state.error && <p role="alert" className="leading-7 text-red-700">{state.error}</p>}
    {state.preview && <div className="space-y-4">
      <h2 className="break-words text-2xl font-semibold">{state.preview.group_name}</h2>
      <p className="text-sm leading-6 text-stone-600">参加すると、このグループのメンバーとして招待の発行・管理ができるようになります。</p>
      <form action={joinAction} aria-busy={joining}>
        <input type="hidden" name="groupId" value={state.preview.group_id} />
        <button disabled={joining || previewing} className="min-h-12 rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:opacity-60">{joining ? "参加中…" : "参加する"}</button>
      </form>
      {joined.error && <p role="alert" className="leading-7 text-red-700">{joined.error}</p>}
    </div>}
    <form action={previewAction} aria-busy={previewing}><button disabled={previewing || joining} className="min-h-11 text-sm font-semibold text-stone-600 underline underline-offset-4 disabled:opacity-60">招待内容を確認し直す</button></form>
    <Link href="/app/groups" className="inline-flex min-h-11 items-center text-sm text-stone-600 underline underline-offset-4">グループ一覧へ</Link>
  </section>;
}
