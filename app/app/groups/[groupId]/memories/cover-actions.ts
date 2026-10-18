"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isGroupId } from "@/lib/groups/validation";
import { revalidateSharedHome } from "@/lib/home/revalidate";
export async function saveCoverAction(_previous: { error: string | null; saved?: boolean }, form: FormData): Promise<{ error: string | null; saved?: boolean }> {
  const group = form.get("groupId"), memory = form.get("memoryId"), photo = form.get("photoId"), revision = Number(form.get("revision"));
  if (!isGroupId(group) || !isGroupId(memory) || (photo !== "" && !isGroupId(photo)) || !Number.isSafeInteger(revision) || revision < 1) return { error: "画面を開き直して写真を選んでください。" };
  try {
    const client = await createClient(), { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直してください。" };
    const result = await client.rpc("set_memory_cover", { p_group_id: group, p_memory_id: memory, p_photo_id: photo || null, p_expected_revision: revision });
    if (result.error) return { error: result.error.code === "40001" ? "別の画面で変更されています。再読み込みしてください。" : "表紙を保存できませんでした。写真が削除されていないか確認してください。" };
    revalidatePath(`/app/groups/${group}/memories/${memory}`); revalidatePath(`/app/groups/${group}/memories`); revalidateSharedHome(group, "memories");
    return { error: null, saved: true };
  } catch { return { error: "表紙を保存できませんでした。もう一度お試しください。" }; }
}
