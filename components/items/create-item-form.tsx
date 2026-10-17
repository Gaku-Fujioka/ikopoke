"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createItemAction } from "@/app/app/groups/[groupId]/items/actions";
import { ITEM_TITLE_LIMIT, ITEM_MEMO_LIMIT } from "@/lib/items/validation";

const inputClass = "min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:opacity-60";

export function CreateItemForm({ groupId, groupName, requestId }: { groupId: string; groupName: string; requestId: string }) {
  const [state, action, pending] = useActionState(createItemAction, { error: null });
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("spot");
  const [memo, setMemo] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.field) {
      const field = formRef.current?.elements.namedItem(state.field);
      if (field instanceof HTMLElement) field.focus();
    }
  }, [state]);
  const description = (field: string, help?: string) => [help, state.field === field ? "item-error" : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <section id="add-item" aria-labelledby="add-item-title" className="scroll-mt-6 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <h2 id="add-item-title" className="text-xl font-semibold">候補を追加</h2>
      <p className="mt-2 break-words text-sm leading-6 text-stone-600">「{groupName}」のメンバーに共有します。</p>
      <form ref={formRef} action={action} aria-busy={pending} className="mt-5 space-y-5">
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="requestId" value={requestId} />
        <div className="space-y-2">
          <label htmlFor="item-title" className="block text-sm font-semibold">名前 <span className="text-orange-700">必須</span></label>
          <input id="item-title" name="title" required value={title} onChange={(event) => setTitle(event.target.value)} disabled={pending} aria-invalid={state.field === "title"} aria-describedby={description("title", "item-title-help")} className={inputClass} placeholder="例：海辺のカフェに行く" />
          <p id="item-title-help" className="text-xs text-stone-500">{ITEM_TITLE_LIMIT}文字以内（現在 {Array.from(title).length}文字）</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="item-kind" className="block text-sm font-semibold">種類 <span className="text-orange-700">必須</span></label>
          <select id="item-kind" name="kind" value={kind} onChange={(event) => setKind(event.target.value)} disabled={pending} aria-invalid={state.field === "kind"} aria-describedby={description("kind")} className={inputClass}>
            <option value="spot">スポット</option><option value="activity">やりたいこと</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="item-memo" className="block text-sm font-semibold">メモ <span className="font-normal text-stone-500">任意</span></label>
          <textarea id="item-memo" name="memo" rows={4} value={memo} onChange={(event) => setMemo(event.target.value)} disabled={pending} aria-invalid={state.field === "memo"} aria-describedby={description("memo", "item-memo-help")} className={`${inputClass} py-3`} placeholder="気になることや、一緒にやってみたいこと" />
          <p id="item-memo-help" className="text-xs text-stone-500">{ITEM_MEMO_LIMIT.toLocaleString("ja-JP")}文字以内（現在 {Array.from(memo).length}文字）</p>
        </div>
        {state.error && <p id="item-error" role="alert" className="text-sm font-medium leading-6 text-red-700">{state.error}</p>}
        <button type="submit" disabled={pending} className="min-h-12 rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{pending ? "保存中…" : "候補を保存"}</button>
      </form>
    </section>
  );
}
