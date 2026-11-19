"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { acceptInviteAction, previewInviteAction } from "@/app/app/groups/invite-actions";
import type { InviteState } from "@/lib/groups/invitations";
import { INVITE_PATH } from "@/lib/groups/invite-cookie";
import { captureInviteEntry, createInviteEntrySnapshot } from "@/lib/groups/invite-entry";
import { authEntryPath } from "@/lib/auth/safe-next-path";
import {ProfileImage} from "@/components/profiles/profile-image";

const initial: InviteState = { error: null };

function InviteBrowserHandoff({ link }: { link: string }) {
  const [message, setMessage] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  return <aside aria-labelledby="invite-browser-heading" className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
    <h2 id="invite-browser-heading" className="font-semibold">Safari・Chromeで開くとき</h2>
    <p className="text-sm leading-6 text-stone-700">LINEなどのアプリ内で開いている場合は、下のボタンで招待リンクをコピーし、SafariやChromeのアドレス欄に貼り付けてから登録・ログインしてください。</p>
    <button type="button" onClick={async () => {
      try {
        await navigator.clipboard.writeText(link);
        setManualCopy(false);
        setMessage("コピーしました。SafariやChromeのアドレス欄に貼り付けて開いてください。");
      } catch {
        setManualCopy(true);
        setMessage("自動でコピーできませんでした。下のリンク欄を長押ししてコピーしてください。");
      }
    }} className="min-h-11 w-full rounded-full border border-orange-700 bg-white px-4 py-2 text-sm font-semibold text-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">別のブラウザで使う招待リンクをコピー</button>
    {message && <p role="status" className="text-sm leading-6 text-stone-700">{message}</p>}
    {manualCopy && <div className="space-y-2">
      <label htmlFor="invite-browser-link" className="block text-sm font-semibold">コピー用の招待リンク</label>
      <input id="invite-browser-link" readOnly value={link} onFocus={event => event.currentTarget.select()} className="min-h-11 w-full rounded-xl border border-orange-200 bg-white px-3 text-sm" />
    </div>}
  </aside>;
}

export function JoinGroup() {
  const [state, previewAction, previewing] = useActionState(previewInviteAction, initial);
  const [joined, joinAction, joining] = useActionState(acceptInviteAction, initial);
  const [entryStore] = useState(() => createInviteEntrySnapshot(() => window.location));
  const entrySnapshot = useSyncExternalStore(entryStore.subscribe, entryStore.getSnapshot, entryStore.getServerSnapshot);
  const handoffLink = entrySnapshot?.handoffLink ?? null;
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Capture the browser snapshot before removing the fragment during hydration.
    entryStore.getSnapshot();
    const form = new FormData();
    const entry = captureInviteEntry(window);
    if (entry) {
      form.set("token", entry.token);
    }
    startTransition(() => previewAction(form));
  }, [entryStore, previewAction]);

  return <section aria-labelledby="join-heading" className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
    <h1 id="join-heading" className="text-3xl font-bold">グループへの招待</h1>
    <p className="text-sm leading-6 text-stone-600">参加先を確認してから「参加する」を押してください。</p>
    {handoffLink && <InviteBrowserHandoff link={handoffLink} />}
    {previewing && <p role="status">招待を確認しています…</p>}
    {state.needLogin && <div className="space-y-4"><p className="leading-7">招待内容を確認するにはログインしてください。登録がまだの方はアカウントを作成できます。</p><div className="flex flex-wrap gap-4"><Link href={authEntryPath("login", INVITE_PATH)} className="inline-flex min-h-12 items-center rounded-full bg-orange-700 px-6 font-semibold text-white">ログイン</Link><Link href={authEntryPath("sign-up", INVITE_PATH)} className="inline-flex min-h-12 items-center font-semibold text-orange-800 underline underline-offset-4">アカウントを作成</Link></div><p className="text-xs leading-5 text-stone-500">同じブラウザで登録・メール確認すると、この招待へ戻れます。別のブラウザを使う場合は招待リンクを開き直してください。</p></div>}
    {state.error && <div className="space-y-2">
      <p role="alert" className="leading-7 text-red-700">{state.error}</p>
      {!handoffLink && <p className="text-sm leading-6 text-stone-600">LINEなどから別のブラウザへ移った場合は、元のメッセージにある招待リンクを長押ししてコピーし、SafariやChromeのアドレス欄に貼り付けて開いてください。</p>}
    </div>}
    {state.preview && <div className="space-y-4">
      {state.preview.cover_path&&<ProfileImage path={state.preview.cover_path} alt="招待先のグループ写真" className="kk-cover-preview"/>}
      <h2 className="break-words text-2xl font-semibold">{state.preview.group_name}</h2>
      {state.preview.description&&<p className="whitespace-pre-wrap break-words text-sm leading-7">{state.preview.description}</p>}
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
