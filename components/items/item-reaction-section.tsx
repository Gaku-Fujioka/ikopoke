import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getReactions, ReactionError } from "@/lib/items/reactions";
import { ItemReactions } from "@/components/items/item-reactions";
import { RetryItems } from "@/components/items/retry-items";

export async function ItemReactionSection({ client, groupId, itemId }: { client: SupabaseClient<Database>; groupId: string; itemId: string }) {
  try {
    return <ItemReactions groupId={groupId} itemId={itemId} summary={await getReactions(client, groupId, itemId)} />;
  } catch (cause) {
    return (
      <section aria-label="リアクション" className="space-y-3 rounded-3xl border border-stone-200 bg-white p-6">
        <p role="status" className="text-sm leading-6 text-stone-600">{cause instanceof ReactionError ? cause.message : "反応を読み込めませんでした。もう一度お試しください。"}</p>
        <RetryItems />
      </section>
    );
  }
}
