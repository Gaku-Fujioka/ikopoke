"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateItemAction } from "@/app/app/groups/[groupId]/items/edit-actions";
import { ITEM_TITLE_LIMIT, ITEM_MEMO_LIMIT } from "@/lib/items/validation";
import type { ItemEditState } from "@/lib/items/edit";

const inputClass = "min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:opacity-60";

export function EditItemForm({ groupId, itemId, title: initialTitle, memo: initialMemo }: { groupId: string; itemId: string; title: string; memo: string }) {
  const [title, setTitle] = useState(initialTitle), [memo, setMemo] = useState(initialMemo);
  // Keep the version actually opened by this editor, even if a reaction causes
  // an RSC refresh while the member has unsaved input.
  const [baseline, setBaseline] = useState({ title: initialTitle, memo: initialMemo });
  const [state, action, pending] = useActionState(async (previous: ItemEditState, form: FormData) => {
    const result = await updateItemAction(previous, form);
    if (result.saved) {
      setBaseline(result.saved); setTitle(result.saved.title); setMemo(result.saved.memo);
    }
    return result;
  }, { error: null });
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.field) {
      const field = formRef.current?.elements.namedItem(state.field);
      if (field instanceof HTMLElement) field.focus();
    }
  }, [state]);
  return (
    <details className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">名前・メモを編集</summary>
      <p className="mt-2 text-sm leading-6 text-stone-600">変更はグループ全員に共有されます。種類は変更しません。</p>
      <form ref={formRef} action={action} aria-busy={pending} className="mt-5 space-y-5">
        <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="expectedTitle" value={baseline.title} /><input type="hidden" name="expectedMemo" value={baseline.memo} />
        <div className="space-y-2">
          <label htmlFor="edit-item-title" className="block text-sm font-semibold">名前（必須）</label>
          <input id="edit-item-title" name="title" required value={title} onChange={event => setTitle(event.target.value)} disabled={pending} aria-invalid={state.field === "title"} aria-describedby={`edit-title-help${state.field === "title" ? " edit-item-error" : ""}`} className={inputClass} />
          <p id="edit-title-help" className="text-xs text-stone-500">{ITEM_TITLE_LIMIT}文字以内（現在 {Array.from(title).length}文字）</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="edit-item-memo" className="block text-sm font-semibold">メモ（任意）</label>
          <textarea id="edit-item-memo" name="memo" rows={4} value={memo} onChange={event => setMemo(event.target.value)} disabled={pending} aria-invalid={state.field === "memo"} aria-describedby={`edit-memo-help${state.field === "memo" ? " edit-item-error" : ""}`} className={`${inputClass} py-3`} />
          <p id="edit-memo-help" className="text-xs text-stone-500">{ITEM_MEMO_LIMIT.toLocaleString("ja-JP")}文字以内（現在 {Array.from(memo).length}文字）</p>
        </div>
        {state.error && <p id="edit-item-error" role="alert" className="text-sm leading-6 text-red-700">{state.error}</p>}
        {state.saved && !pending && title === state.saved.title && memo === state.saved.memo && <p role="status" className="text-sm text-stone-600">変更を保存しました。</p>}
        <button disabled={pending} className="min-h-12 rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:opacity-60">{pending ? "保存中…" : "変更を保存"}</button>
      </form>
    </details>
  );
}
