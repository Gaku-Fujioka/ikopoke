"use client";

import { useActionState } from "react";
import { Heart, Minus } from "lucide-react";
import { setReactionAction } from "@/app/app/groups/[groupId]/items/reaction-actions";
import { REACTION_OPTIONS, reactionLabel, type ReactionSummary } from "@/lib/items/reaction-values";

export function ItemReactions({ groupId, itemId, summary }: { groupId: string; itemId: string; summary: ReactionSummary }) {
  const [state, action, pending] = useActionState(setReactionAction, { error: null });
  return (
    <section aria-labelledby="reaction-heading" className="space-y-5">
      <div>
        <h2 id="reaction-heading" className="text-xl font-semibold">この行き先、どう？</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">現在の反応：{reactionLabel(summary.my_reaction)}</p>
      </div>
      <dl aria-label="みんなの反応" className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <div className="flex items-center gap-2"><dt>行きたい！</dt><dd className="font-semibold">{summary.want_count}人</dd></div>
        <div className="flex items-center gap-2"><dt>そこまで</dt><dd className="font-semibold">{summary.not_now_count}人</dd></div>
      </dl>
      <form action={action} aria-busy={pending} className="space-y-4">
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="itemId" value={itemId} />
        <div className="flex flex-wrap gap-3">
          {REACTION_OPTIONS.map((option) => (
            <button key={option.value} type="submit" name="reaction" data-reaction={option.value} value={option.value} aria-pressed={summary.my_reaction === option.value} disabled={pending} className={`kk-reaction-button inline-flex items-center justify-center gap-2 min-h-12 rounded-full border px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${summary.my_reaction === option.value ? "border-orange-700 bg-orange-50 text-orange-800" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"}`}>
              {option.value === "want_to_go" ? <Heart size={17} aria-hidden="true" fill={summary.my_reaction === option.value ? "currentColor" : "none"} /> : <Minus size={17} aria-hidden="true" />}
              {option.label}
            </button>
          ))}
          <button type="submit" name="reaction" value="clear" disabled={pending || summary.my_reaction === null} className="min-h-12 rounded-full px-4 text-sm font-semibold text-stone-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:opacity-50">反応を取り消す</button>
        </div>
        {pending && <p role="status" className="text-sm text-stone-600">反応を保存しています…</p>}
        {state.error && <p role="alert" className="text-sm leading-6 text-red-700">{state.error}</p>}
        {!pending && state.saved && <p role="status" className="text-sm text-stone-600">反応を保存しました。</p>}
      </form>
      <p className="text-xs leading-5 text-stone-500">ほかの人の反応は、ページを再読み込みすると反映されます。</p>
    </section>
  );
}
