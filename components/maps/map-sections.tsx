import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { SavedOutingItem } from "@/lib/outings/repository";
import { itemPlace, mapCandidates, mapsConfig, PlaceStoreError, type PlaceGroup } from "@/lib/maps/saved";
import { SavedPlacesMap } from "./saved-places-map";
import { SearchWorkspace } from "./search-workspace";
import { AttachPlaceForm } from "./place-save-form";

type Client = SupabaseClient<Database>;
export async function SavedMapSection({ client, groupId, groups }: { client: Client; groupId: string | null; groups: PlaceGroup[] }) {
  let candidates;
  try {
    candidates = await mapCandidates(client, groupId);
  } catch (cause) { return <p role="alert" className="kk-map-note">{cause instanceof PlaceStoreError ? cause.message : "保存した場所を読み込めませんでした。候補は行きたいタブから確認できます。"}</p>; }
  return <SavedPlacesMap candidates={candidates} groups={groups} config={mapsConfig()} showGroups={!groupId} />;
}
export async function ItemPlaceSection({ client, groupId, itemId, title }: { client: Client; groupId: string; itemId: string; title: string }) {
  let placeId;
  try { placeId = await itemPlace(client, groupId, itemId); }
  catch (cause) { return <p role="alert" className="kk-map-note">{cause instanceof PlaceStoreError ? cause.message : "場所の紐づけを読み込めませんでした。"}</p>; }
  return <section className="kk-item-location space-y-4" aria-label="候補の場所"><div className="kk-section-heading"><h2>ここは、どこ？</h2><span className="kk-label">{placeId ? "場所を紐づけ済み" : "場所は未設定"}</span></div>
    {placeId ? <SavedPlacesMap key={placeId} candidates={[{ itemId, groupId, title, placeId }]} groups={[]} config={mapsConfig()} showGroups={false} /> : <p className="kk-muted">場所を選ぶと、地図やおでかけ計画から迷わず開けます。</p>}
    <details className="kk-inline-editor"><summary className="kk-edit-button">{placeId ? "場所を変更する" : "場所を検索して紐づける"}</summary><SearchWorkspace key={placeId ?? "unset"} config={mapsConfig()} groups={[]} groupId={groupId} attach={{ itemId, placeId }} /></details>
    {placeId && <details><summary className="kk-edit-button">… 場所の管理</summary><AttachPlaceForm key={placeId} groupId={groupId} itemId={itemId} placeId={null} expectedPlaceId={placeId} label="場所の紐づけを解除する" /></details>}
  </section>;
}
export async function OutingMapSection({ client, groupId, items, group }: { client: Client; groupId: string; items: SavedOutingItem[]; group: PlaceGroup }) {
  let candidates: Awaited<ReturnType<typeof mapCandidates>>, ordered, missing;
  try {
    candidates = await mapCandidates(client, groupId, items.map(item => item.item_id));
    ordered = items.flatMap((item, index) => { const candidate = candidates.find(row => row.itemId === item.item_id); return candidate ? [{ ...candidate, stopNumber: index + 1 }] : []; });
    missing = items.length - ordered.length;
  } catch { return <p role="alert" className="kk-map-note">行き先の地図を読み込めませんでした。計画と訪問記録は引き続き使えます。</p>; }
  return <div className="space-y-3"><SavedPlacesMap candidates={ordered} groups={[group]} config={mapsConfig()} ordered showGroups={false} />{missing > 0 && <p className="kk-map-note">場所が未設定の行き先が{missing}件あります。下の行き先名から候補詳細を開き、「ここは、どこ？」で紐づけてください。</p>}</div>;
}
