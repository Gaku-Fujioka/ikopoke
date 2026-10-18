"use client";

import { useActionState } from "react";
import { setItemListAction } from "@/app/app/groups/[groupId]/lists/actions";

export function ItemListButton({ groupId, itemId, listId, selected, label }: { groupId: string; itemId: string; listId: string; selected: boolean; label?: string }) {
  const [state, action, pending] = useActionState(setItemListAction, { error: null });
  return <form action={action} aria-busy={pending} className="flex flex-col items-start gap-1">
    <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="listId" value={listId} /><input type="hidden" name="selected" value={String(!selected)} />
    <button disabled={pending} aria-pressed={selected} aria-label={label ? `${label}${selected ? "から外す" : "に入れる"}` : undefined} className={label ? "kk-list-toggle" : `min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:opacity-60 ${selected ? "border-orange-700 bg-orange-50 text-orange-800" : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}>{pending ? "保存中…" : label ? `${selected ? "✓" : "＋"} ${label}` : selected ? "リストから外す" : "リストに入れる"}</button>
    {state.error && <span role="alert" className="text-xs text-red-700">{state.error}</span>}
    {state.saved && !pending && <span role="status" className="text-xs text-stone-600">保存しました。</span>}
  </form>;
}
