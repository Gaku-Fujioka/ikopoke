"use client";

import { useActionState, useState } from "react";
import { renameGroupAction } from "@/app/app/groups/rename-actions";
import { GROUP_NAME_LIMIT } from "@/lib/groups/validation";
import type { RenameGroupState } from "@/lib/groups/rename";

export function RenameGroupForm({ groupId, name: initialName }: { groupId: string; name: string }) {
  const [name, setName] = useState(initialName), [expectedName, setExpectedName] = useState(initialName);
  const [state, action, pending] = useActionState(async (previous: RenameGroupState, form: FormData) => {
    const result = await renameGroupAction(previous, form);
    if (result.savedName) { setName(result.savedName); setExpectedName(result.savedName); }
    return result;
  }, { error: null });
  return (
    <details className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">グループ名を変更</summary>
      <form action={action} aria-busy={pending} className="mt-4 space-y-4">
        <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="expectedName" value={expectedName} />
        <label htmlFor="group-rename" className="block text-sm font-semibold">グループの名前（必須）</label>
        <input id="group-rename" name="name" required value={name} onChange={event => setName(event.target.value)} disabled={pending} aria-invalid={Boolean(state.error)} aria-describedby={`group-rename-help${state.error ? " group-rename-error" : ""}`} className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:opacity-60" />
        <p id="group-rename-help" className="text-xs leading-5 text-stone-500">{GROUP_NAME_LIMIT}文字以内（現在 {Array.from(name).length}文字）。変更はグループ全員に共有されます。</p>
        {state.error && <p id="group-rename-error" role="alert" className="text-sm leading-6 text-red-700">{state.error}</p>}
        {state.savedName && !pending && name === state.savedName && <p role="status" className="text-sm text-stone-600">グループ名を変更しました。</p>}
        <button disabled={pending} className="min-h-12 rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:opacity-60">{pending ? "保存中…" : "名前を保存"}</button>
      </form>
    </details>
  );
}
