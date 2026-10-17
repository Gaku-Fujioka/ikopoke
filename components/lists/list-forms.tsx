"use client";

import { useActionState, useState } from "react";
import { createListAction, deleteListAction, renameListAction, type ListActionState } from "@/app/app/groups/[groupId]/lists/actions";
import { LIST_NAME_LIMIT } from "@/lib/lists/validation";

const initial: ListActionState = { error: null };
const inputClass = "min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:opacity-60";
const buttonClass = "min-h-11 rounded-full bg-orange-700 px-5 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:opacity-60";

export function CreateListForm({ groupId, initialRequestId }: { groupId: string; initialRequestId: string }) {
  const [requestId, setRequestId] = useState(initialRequestId), [name, setName] = useState("");
  const [state, action, pending] = useActionState(async (previous: ListActionState, form: FormData) => {
    const result = await createListAction(previous, form);
    if (result.saved) { setName(""); setRequestId(crypto.randomUUID()); }
    return result;
  }, initial);
  return <form action={action} aria-busy={pending} className="space-y-3 rounded-3xl border border-stone-200 bg-white p-6">
    <h2 className="text-xl font-semibold">リストを作成</h2>
    <p className="text-sm text-stone-600">カフェ・行きたい街など、好きな名前で分類できます。候補は複数リストに入れられます。</p>
    <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="requestId" value={requestId} />
    <label htmlFor="new-list-name" className="block text-sm font-semibold">リスト名（必須・{LIST_NAME_LIMIT}文字以内）</label>
    <input id="new-list-name" name="name" required value={name} onChange={event=>setName(event.target.value)} disabled={pending} aria-invalid={Boolean(state.error)} className={inputClass} />
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.saved && !pending && !name && <p role="status" className="text-sm text-stone-600">リストを作成しました。</p>}
    <button disabled={pending} className={buttonClass}>{pending ? "作成中…" : "リストを作成"}</button>
  </form>;
}

export function ManageListForm({ groupId, listId, initialName }: { groupId: string; listId: string; initialName: string }) {
  const [name, setName] = useState(initialName), [expectedName, setExpectedName] = useState(initialName);
  const [renameState, renameAction, renaming] = useActionState(async (previous: ListActionState, form: FormData) => {
    const result = await renameListAction(previous, form);
    if (result.name) { setName(result.name); setExpectedName(result.name); }
    return result;
  }, initial);
  const [deleteState, deleteAction, deleting] = useActionState(deleteListAction, initial);
  return <div className="space-y-3">
    <details className="rounded-2xl bg-stone-50 p-4">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-orange-700">名前を変更</summary>
      <form action={renameAction} aria-busy={renaming} className="mt-3 space-y-3">
        <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="listId" value={listId} /><input type="hidden" name="expectedName" value={expectedName} />
        <label htmlFor={`rename-list-${listId}`} className="block text-sm font-semibold">新しいリスト名（{LIST_NAME_LIMIT}文字以内）</label>
        <input id={`rename-list-${listId}`} name="name" required value={name} onChange={event=>setName(event.target.value)} disabled={renaming} className={inputClass} />
        {renameState.error && <p role="alert" className="text-sm text-red-700">{renameState.error}</p>}
        {renameState.saved && !renaming && name===renameState.name && <p role="status" className="text-sm text-stone-600">名前を保存しました。</p>}
        <button disabled={renaming} className={buttonClass}>{renaming ? "保存中…" : "名前を保存"}</button>
      </form>
    </details>
    <details className="rounded-2xl bg-stone-50 p-4">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-red-700">リストを削除</summary>
      <p className="mt-2 text-sm leading-6 text-stone-700">「{expectedName}」を削除します。候補・コメント・反応は残り、このリストへの分類だけが外れます。</p>
      <form action={deleteAction} aria-busy={deleting} className="mt-3 space-y-3">
        <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="listId" value={listId} /><input type="hidden" name="expectedName" value={expectedName} />
        {deleteState.error && <p role="alert" className="text-sm text-red-700">{deleteState.error}</p>}
        <button disabled={deleting} className="min-h-11 rounded-full border border-red-700 px-5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">{deleting ? "削除中…" : "このリストを削除"}</button>
      </form>
    </details>
  </div>;
}
