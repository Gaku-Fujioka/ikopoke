"use client";

import { useActionState } from "react";
import { Heart, Minus } from "lucide-react";
import { setReactionAction } from "@/app/app/groups/[groupId]/items/reaction-actions";
import type { ReactionValue } from "@/lib/items/reaction-values";

export function QuickReaction({ groupId, itemId, title, value, count }: { groupId: string; itemId: string; title: string; value: ReactionValue | null; count: number }) {
  const [state, action, pending] = useActionState(setReactionAction, { error: null });
  return <form action={action} aria-label={`${title}への反応`} aria-busy={pending} className="kk-quick-reaction">
    <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="itemId" value={itemId} />
    <div className="flex flex-wrap gap-2">
      <button name="reaction" value={value === "want_to_go" ? "clear" : "want_to_go"} aria-pressed={value === "want_to_go"} disabled={pending} className="kk-reaction-pill"><Heart size={16} aria-hidden="true" fill={value === "want_to_go" ? "currentColor" : "none"} />行きたい！<span>{count}</span></button>
      <button name="reaction" value={value === "not_now" ? "clear" : "not_now"} aria-pressed={value === "not_now"} disabled={pending} className="kk-reaction-pill"><Minus size={15} aria-hidden="true" />そこまで</button>
    </div>
    <span className="sr-only">選択中の反応をもう一度押すと取り消せます。</span>
    {pending && <p role="status">保存中…</p>}{state.error && <p role="alert">{state.error}</p>}{state.saved && !pending && <p role="status" className="sr-only">反応を保存しました。</p>}
  </form>;
}
