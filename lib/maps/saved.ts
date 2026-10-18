import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isGroupId } from "@/lib/groups/validation";
import type { MapsConfig } from "./google";

export type MapCandidate = { itemId: string; groupId: string; title: string; placeId: string; stopNumber?: number };
export type PlaceGroup = { id: string; name: string };
export function validPlaceId(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_-]{1,255}$/.test(value); }
export function mapsConfig(): MapsConfig {
  return { enabled: process.env.NEXT_PUBLIC_GOOGLE_MAPS_ENABLED === "true", placesEnabled: process.env.NEXT_PUBLIC_GOOGLE_PLACES_ENABLED === "true", apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "", mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "" };
}
export class PlaceStoreError extends Error {
  constructor(code?: string) {
    super(["42P01", "PGRST202", "PGRST205"].includes(code ?? "") ? "場所の保存機能は準備中です。手入力の候補は引き続き使えます。" : code === "40001" ? "場所の紐づけが別の画面で変更されました。再読み込みしてご確認ください。" : code === "23505" ? "この場所はすでに保存されているか、同じ操作が変更されています。候補一覧をご確認ください。" : "場所を保存・取得できませんでした。ログイン状態や通信状態をご確認ください。");
    this.name = "PlaceStoreError";
  }
}
export function parsePlaceSave(form: FormData) {
  const groupId = form.get("groupId"), placeId = form.get("placeId"), requestId = form.get("requestId"), rawTitle = form.get("title");
  const listIds = [...new Set(form.getAll("listIds"))];
  if (!isGroupId(groupId) || !validPlaceId(placeId) || !isGroupId(requestId) || typeof rawTitle !== "string" || !rawTitle.trim() || [...rawTitle.trim()].length > 100 || listIds.length > 20 || !listIds.every(isGroupId)) throw new Error("呼び名（100文字以内）と保存先を確認してください。");
  return { groupId, placeId, requestId, title: rawTitle.trim(), listIds: listIds as string[] };
}
export async function itemPlace(client: SupabaseClient<Database>, groupId: string, itemId: string) {
  const { data, error } = await client.from("item_places").select("item_id,group_id,place_id").eq("group_id", groupId).eq("item_id", itemId).maybeSingle();
  if (error) throw new PlaceStoreError(error.code);
  return data?.place_id ?? null;
}
export async function mapCandidates(client: SupabaseClient<Database>, groupId: string | null, itemIds?: string[]): Promise<MapCandidate[]> {
  if (itemIds && !itemIds.length) return [];
  const result: MapCandidate[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    let query = client.from("item_places").select("item_id,group_id,place_id").order("item_id").range(offset, offset + 499);
    if (groupId) query = query.eq("group_id", groupId);
    if (itemIds) query = query.in("item_id", [...new Set(itemIds)]);
    const { data: links, error } = await query;
    if (error) throw new PlaceStoreError(error.code);
    if (links?.length) {
      let items = client.from("items").select("id,group_id,title,kind,archived_at").in("id", links.map(row => row.item_id));
      if (!itemIds) items = items.is("archived_at", null);
      const { data, error: itemError } = await items;
      if (itemError) throw new PlaceStoreError(itemError.code);
      for (const row of data ?? []) {
        const link = links.find(link => link.item_id === row.id && link.group_id === row.group_id);
        if (row.kind === "spot" && link && validPlaceId(link.place_id)) result.push({ itemId: row.id, groupId: row.group_id, title: row.title, placeId: link.place_id });
      }
    }
    if ((links?.length ?? 0) < 500) return result;
  }
  throw new PlaceStoreError();
}
export function directionsHref(placeId: string, title: string): string {
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination: title, destination_place_id: placeId })}`;
}
