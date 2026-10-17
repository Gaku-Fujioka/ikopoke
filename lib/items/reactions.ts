import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import type { ReactionValue, ReactionSummary } from "./reaction-values";

export class ReactionError extends Error {
  constructor(error: { code?: string } | null) {
    super(error && ["42P01", "PGRST202", "PGRST205"].includes(error.code ?? "")
      ? "リアクションは準備中です。利用できるようになるまでお待ちください。"
      : "反応を読み書きできませんでした。ログイン状態や通信状態をご確認のうえ、もう一度お試しください。");
    this.name = "ReactionError";
  }
}

export async function getReactions(client: SupabaseClient<Database>, groupId: string, itemId: string): Promise<ReactionSummary> {
  const { data, error } = await client.rpc("get_item_reactions", { p_group_id: groupId, p_item_id: itemId });
  if (error || !data?.[0]) throw new ReactionError(error);
  const { want_count, not_now_count, my_reaction } = data[0];
  if (!Number.isSafeInteger(want_count) || want_count < 0 || !Number.isSafeInteger(not_now_count) || not_now_count < 0 ||
      (my_reaction !== null && my_reaction !== "want_to_go" && my_reaction !== "not_now")) throw new ReactionError(null);
  return { want_count, not_now_count, my_reaction };
}

export async function setReaction(client: SupabaseClient<Database>, groupId: string, itemId: string, value: ReactionValue | null): Promise<void> {
  const { error } = await client.rpc("set_item_reaction", { p_group_id: groupId, p_item_id: itemId, p_value: value });
  if (error) throw new ReactionError(error);
}
