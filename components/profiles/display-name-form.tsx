"use client";

import { useActionState, useState } from "react";
import { saveProfileAction } from "@/app/app/profile/actions";
import { DISPLAY_NAME_LIMIT } from "@/lib/profiles/validation";

export function DisplayNameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [state, action, pending] = useActionState(saveProfileAction, { error: null });
  return <form action={action} aria-busy={pending} className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
    <div className="space-y-2"><label htmlFor="profile-display-name" className="block font-semibold">表示名</label><input id="profile-display-name" name="displayName" autoComplete="nickname" required value={name} onChange={event => setName(event.target.value)} disabled={pending} aria-invalid={Boolean(state.error)} className="min-h-12 w-full rounded-xl border border-stone-300 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700" /><p className="text-sm text-stone-600">{DISPLAY_NAME_LIMIT}文字以内。参加しているグループのメンバーに表示されます。</p></div>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.savedName && !pending && state.savedName === name && <p role="status" className="text-sm text-stone-600">表示名を保存しました。</p>}
    <button disabled={pending} className="min-h-12 rounded-full bg-orange-700 px-6 font-semibold text-white disabled:opacity-60">{pending ? "保存中…" : "表示名を保存"}</button>
  </form>;
}
