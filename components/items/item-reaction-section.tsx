import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getReactions, ReactionError } from "@/lib/items/reactions";
import { ItemReactions } from "@/components/items/item-reactions";
import { RetryItems } from "@/components/items/retry-items";

export async function ItemReactionSection({ client, groupId, itemId }: { client: SupabaseClient<Database>; groupId: string; itemId: string }) {
  let summary, named;
  try {
    [summary, named] = await Promise.all([getReactions(client, groupId, itemId), Promise.resolve().then(() => client.rpc("get_named_item_reactions", { p_group_id: groupId, p_item_id: itemId }))]);
  } catch (cause) {
    return (
      <section aria-label="リアクション" className="space-y-3 rounded-3xl border border-stone-200 bg-white p-6">
        <p role="status" className="text-sm leading-6 text-stone-600">{cause instanceof ReactionError ? cause.message : "反応を読み込めませんでした。もう一度お試しください。"}</p>
        <RetryItems />
      </section>
    );
  }
  return <section className="kk-reaction-feature"><ItemReactions groupId={groupId} itemId={itemId} summary={summary} /><section className="kk-reaction-members" aria-label="反応したメンバー"><h2 className="font-semibold">みんなの気持ち</h2>{named.error ? <p role="status">名前を読み込めませんでした。<RetryItems /></p> : <><ul className="mt-3 flex flex-wrap gap-2">{named.data?.map((r,index) => <li key={index} className="rounded-full bg-orange-50 px-3 py-2 text-sm">{r.display_name}{r.is_mine ? "（あなた）" : ""} · {r.value === "want_to_go" ? "行きたい！" : "そこまで"}</li>)}</ul>{!named.data?.length && <p className="mt-3 text-sm text-stone-600">最初の気持ちを伝えてみよう。</p>}{Number(named.data?.[0]?.total_count) > 100 && <p className="mt-3 text-xs">最新の100人を表示しています。全員の反応は上の件数に含まれます。</p>}</>}</section></section>;
}
