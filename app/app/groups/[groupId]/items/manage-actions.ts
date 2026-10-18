"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateSharedHome } from "@/lib/home/revalidate";
import { isGroupId } from "@/lib/groups/validation";

export type ManageState = { error: string | null; saved?: boolean };
export async function manageItemAction(_previous: ManageState, form: FormData): Promise<ManageState> {
  const group = form.get("groupId"), item = form.get("itemId"), operation = form.get("operation");
  if (!isGroupId(group) || !isGroupId(item)) return { error: "画面を開き直してください。" };
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直してください。" };
    let result;
    if (operation === "attributes") {
      const priority = form.get("priority"), expected = form.get("expectedPriority"), archived = form.get("archived"), previous = form.get("expectedArchived");
      if (typeof priority !== "string" || !/^[0-3]$/.test(priority) || typeof expected !== "string" || !/^[0-3]$/.test(expected) || !["0", "1"].includes(String(archived)) || !["0", "1"].includes(String(previous))) return { error: "入力内容をご確認ください。" };
      if (archived === "1" && previous === "0" && form.get("confirm") !== "yes") return { error: "記録を残してアーカイブすることを確認してください。" };
      result = await client.rpc("set_item_attributes", { p_group_id: group, p_item_id: item, p_priority: Number(priority), p_expected_priority: Number(expected), p_archived: archived === "1", p_expected_archived: previous === "1" });
    } else {
      const comment = form.get("commentId"), revision = Number(form.get("revision"));
      if (!isGroupId(comment) || !Number.isSafeInteger(revision) || revision < 1) return { error: "画面を開き直してください。" };
      if (operation === "editComment") {
        const body = form.get("body");
        if (typeof body !== "string" || !body.trim() || Array.from(body.trim()).length > 2000) return { error: "コメントは1〜2,000文字で入力してください。" };
        result = await client.rpc("edit_item_comment", { p_group_id: group, p_item_id: item, p_comment_id: comment, p_body: body.trim(), p_expected_revision: revision });
      } else if (operation === "deleteComment" && form.get("confirm") === "yes") {
        result = await client.rpc("delete_item_comment", { p_group_id: group, p_item_id: item, p_comment_id: comment, p_expected_revision: revision });
      } else return { error: "削除の確認をしてください。" };
    }
    if (result.error) return { error: result.error.code === "40001" ? "別の画面で変更されています。入力を控えて再読み込みしてください。" : "保存できませんでした。所属と通信状態をご確認ください。" };
    revalidatePath(`/app/groups/${group}/items`);
    revalidatePath(`/app/groups/${group}/items/${item}`);
    revalidateSharedHome(group, "items");
    return { error: null, saved: true };
  } catch { return { error: "保存できませんでした。もう一度お試しください。" }; }
}
