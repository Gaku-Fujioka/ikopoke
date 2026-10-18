"use client";
import Link from "next/link";

import { useActionState, useEffect, useRef, useState } from "react";
import { createItemAction } from "@/app/app/groups/[groupId]/items/actions";
import { ITEM_TITLE_LIMIT, ITEM_MEMO_LIMIT } from "@/lib/items/validation";

const inputClass = "min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:opacity-60";

export function CreateItemForm({ groupId, groupName, requestId, lists = [], listsUnavailable = false, moreLists = false }: { groupId: string; groupName: string; requestId: string; lists?: { id: string; name: string }[]; listsUnavailable?: boolean; moreLists?: boolean }) {
  const [state, action, pending] = useActionState(createItemAction, { error: null });
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("spot");
  const [memo, setMemo] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.field) {
      const field = formRef.current?.elements.namedItem(state.field);
      if (field instanceof HTMLElement) { const details = field.closest("details"); if (details) details.open = true; field.focus(); }
    }
  }, [state]);
  const description = (field: string, help?: string) => [help, state.field === field ? "item-error" : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <section id="add-item" aria-labelledby="add-item-title" className="kk-add-candidate">
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
        <details className="kk-add-extras"><summary className="kk-edit-button">メモ・リストを添える（任意）</summary><div className="mt-4 space-y-2">
          <label htmlFor="item-memo" className="block text-sm font-semibold">メモ <span className="font-normal text-stone-500">任意</span></label>
          <textarea id="item-memo" name="memo" rows={4} value={memo} onChange={(event) => setMemo(event.target.value)} disabled={pending} aria-invalid={state.field === "memo"} aria-describedby={description("memo", "item-memo-help")} className={`${inputClass} py-3`} placeholder="気になることや、一緒にやってみたいこと" />
          <p id="item-memo-help" className="text-xs text-stone-500">{ITEM_MEMO_LIMIT.toLocaleString("ja-JP")}文字以内（現在 {Array.from(memo).length}文字）</p>
        </div>
        <fieldset className="mt-5 space-y-3"><legend className="font-semibold">リストに分類（複数選択できます）</legend>{lists.map(list => <label key={list.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="listIds" value={list.id} disabled={pending} /><span>{list.name}</span></label>)}{!lists.length && <p className="kk-muted">{listsUnavailable ? "リストを読み込めませんでした。候補は分類せずに保存できます。" : "リストはまだありません。保存後にも分類できます。"}</p>}{moreLists && <p className="kk-muted">最近の20件を表示しています。ほかのリストには保存後の候補詳細から分類できます。</p>}</fieldset></details>
        {state.createdItemId && <p role="status" className="kk-notice">候補本体は保存されています。分類だけを再試行するか、<Link className="underline" href={`/app/groups/${groupId}/items/${state.createdItemId}`}>保存した候補を開く</Link>ことができます。</p>}
        {state.error && <p id="item-error" role="alert" className="text-sm font-medium leading-6 text-red-700">{state.error}</p>}
        <button type="submit" disabled={pending} className="min-h-12 rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{pending ? "共有しています…" : "みんなの行きたいに追加 →"}</button>
      </form>
    </section>
  );
}
