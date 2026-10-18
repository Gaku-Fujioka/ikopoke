"use server";

import { revalidatePath } from "next/cache";
import { revalidateSharedHome } from "@/lib/home/revalidate";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { isGroupId } from "@/lib/groups/validation";
import { setReaction, ReactionError } from "@/lib/items/reactions";
import type { ReactionState } from "@/lib/items/reaction-values";

export async function setReactionAction(_previous: ReactionState, form: FormData): Promise<ReactionState> {
  if (!hasEnvVars) return { error: "リアクションは準備中です。" };
  const groupId = form.get("groupId"), itemId = form.get("itemId"), value = form.get("reaction");
  if (!isGroupId(groupId) || !isGroupId(itemId) || (value !== "want_to_go" && value !== "not_now" && value !== "clear")) {
    return { error: "反応を選び直してください。画面を開き直しても解決しない場合は、しばらくお待ちください。" };
  }
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直して、もう一度お試しください。" };
    await setReaction(client, groupId, itemId, value === "clear" ? null : value);
  } catch (error) {
    return { error: error instanceof ReactionError ? error.message : "反応を保存できませんでした。もう一度お試しください。" };
  }
  revalidatePath(`/app/groups/${groupId}/items/${itemId}`);
  revalidatePath(`/app/groups/${groupId}/items`);
  revalidateSharedHome(groupId);
  return { error: null, saved: true };
}
