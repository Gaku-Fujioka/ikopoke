"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateSharedHome } from "@/lib/home/revalidate";
import { isGroupId } from "@/lib/groups/validation";
import { listLists } from "@/lib/lists/repository";
import { parsePlaceSave, PlaceStoreError, validPlaceId } from "@/lib/maps/saved";

export async function placeListsAction(groupId: string) {
  if (!isGroupId(groupId)) return { error: "保存先を選んでください。", lists: [] };
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直してください。", lists: [] };
    const result = await listLists(client, groupId, 1);
    return { lists: result.lists.map(({ id, name }) => ({ id, name })), more: result.total > result.lists.length };
  } catch { return { error: "リストを読み込めませんでした。分類せずに保存し、後から変更できます。", lists: [] }; }
}
export type PlaceSaveState = { error: string | null; itemId?: string; groupId?: string; reused?: boolean; archived?: boolean };
export async function savePlaceAction(_previous: PlaceSaveState, form: FormData): Promise<PlaceSaveState> {
  let input;
  try { input = parsePlaceSave(form); } catch (cause) { return { error: cause instanceof Error ? cause.message : "入力内容を確認してください。" }; }
  try {
    const client = await createClient();
    const { data: claims, error: authError } = await client.auth.getClaims();
    if (authError || !claims?.claims?.sub) return { error: "ログインし直して、もう一度お試しください。" };
    const { data, error } = await client.rpc("save_place_item", { p_group_id: input.groupId, p_place_id: input.placeId, p_title: input.title, p_list_ids: input.listIds, p_request_id: input.requestId });
    if (error || !data?.[0]) throw new PlaceStoreError(error?.code);
    const row = data[0];
    revalidatePath(`/app/groups/${input.groupId}/items`);
    revalidatePath(`/app/groups/${input.groupId}/items/${row.item_id}`);
    revalidateSharedHome(input.groupId, "items");
    return { error: null, itemId: row.item_id, groupId: input.groupId, reused: row.reused, archived: row.archived };
  } catch (cause) { return { error: cause instanceof PlaceStoreError ? cause.message : "保存できませんでした。もう一度お試しください。" }; }
}
export async function attachPlaceAction(_previous: PlaceSaveState, form: FormData): Promise<PlaceSaveState> {
  const groupId = form.get("groupId"), itemId = form.get("itemId"), place = form.get("placeId"), expected = form.get("expectedPlaceId");
  if (!isGroupId(groupId) || !isGroupId(itemId) || (place !== "" && !validPlaceId(place)) || (expected !== "" && !validPlaceId(expected))) return { error: "画面を開き直して、場所を選んでください。" };
  try {
    const client = await createClient();
    const { data, error: authError } = await client.auth.getClaims();
    if (authError || !data?.claims?.sub) return { error: "ログインし直してください。" };
    const { error } = await client.rpc("set_item_place", { p_group_id: groupId, p_item_id: itemId, p_place_id: place || null, p_expected_place_id: expected || null });
    if (error) throw new PlaceStoreError(error.code);
    revalidatePath(`/app/groups/${groupId}/items/${itemId}`);
    revalidatePath(`/app/groups/${groupId}/outings`, "layout");
    revalidateSharedHome(groupId, "items");
    return { error: null, itemId, groupId };
  } catch (cause) { return { error: cause instanceof PlaceStoreError ? cause.message : "場所を変更できませんでした。" }; }
}
