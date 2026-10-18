"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isGroupId } from "@/lib/groups/validation";
import { revalidateSharedHome } from "@/lib/home/revalidate";
export type PhotoManageState = { error: string | null; saved?: boolean };
export async function manageVisitAction(_previous: PhotoManageState, form: FormData): Promise<PhotoManageState> {
  const group = form.get("groupId"), visit = form.get("visitId"), operation = form.get("operation");
  if (!isGroupId(group) || !isGroupId(visit)) return { error: "画面を開き直してください。" };
  let removedVisit = false;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直してください。" };
    if (operation === "order") {
      const ids: unknown = JSON.parse(String(form.get("ids"))), expected: unknown = JSON.parse(String(form.get("expectedIds")));
      if (!Array.isArray(ids) || !Array.isArray(expected) || ids.length > 10 || expected.length > 10 || !ids.every(isGroupId) || !expected.every(isGroupId)) throw new Error();
      const result = await client.rpc("reorder_visit_photos", { p_group_id: group, p_visit_id: visit, p_ids: ids, p_expected_ids: expected });
      if (result.error) throw result.error;
    } else if (operation === "deletePhoto" && form.get("confirm") === "yes") {
      const photo = form.get("photoId"); if (!isGroupId(photo)) throw new Error();
      const args = { p_group_id: group, p_visit_id: visit, p_photo_id: photo };
      const begin = await client.rpc("begin_remove_photo", args); if (begin.error) throw begin.error;
      if (begin.data) {
        const removed = await client.storage.from("visit-photos").remove([begin.data]);
        if (removed.error) throw removed.error;
      }
      const end = await client.rpc("finish_remove_photo", args); if (end.error) throw end.error;
    } else if (operation === "deleteVisit" && form.get("confirm") === "yes") {
      const revision = Number(form.get("revision")); if (!Number.isSafeInteger(revision) || revision < 1) throw new Error();
      const begin = await client.rpc("begin_remove_visit", { p_group_id: group, p_visit_id: visit, p_expected_revision: revision }); if (begin.error) throw begin.error;
      const paths = begin.data?.map(row => row.object_path) ?? [];
      if (paths.length) { const removed = await client.storage.from("visit-photos").remove(paths); if (removed.error) throw removed.error; }
      const end = await client.rpc("finish_remove_visit", { p_group_id: group, p_visit_id: visit }); if (end.error) throw end.error;
      removedVisit = true;
    } else return { error: "削除の確認をしてください。" };
  } catch (cause) {
    const conflict = cause && typeof cause === "object" && "code" in cause && cause.code === "40001";
    return { error: conflict ? "別の画面で変更されています。再読み込みして確認してください。" : "操作が完了しませんでした。所属・権限と通信状態を確認し、同じ操作を再試行してください。削除開始後は写真の追加や記録の編集ができません。" };
  } finally {
    revalidatePath(`/app/groups/${group}/visits`); revalidatePath(`/app/groups/${group}/visits/${visit}`);
    revalidatePath("/app/groups/[groupId]/memories/[memoryId]", "page");
    revalidatePath("/app/groups/[groupId]/items/[itemId]", "page");
    revalidatePath("/app/groups/[groupId]/outings/[outingId]", "page");
    revalidatePath(`/app/groups/${group}/memories`); revalidatePath("/app/memories");
    revalidatePath(`/app/groups/${group}/items`); revalidatePath("/app/items");
    revalidateSharedHome(group);
  }
  if (removedVisit) redirect(`/app/groups/${group}/visits`);
  return { error: null, saved: true };
}
