"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createMapExplorer, initialExplorerState } from "@/lib/maps/explorer";
import { startGoogleMap, type MapsConfig } from "@/lib/maps/google";
import { directionsHref, type MapCandidate, type PlaceGroup } from "@/lib/maps/saved";
import { PlaceDetailPanel } from "./place-detail-panel";

export function SavedPlacesMap({ candidates, groups, config, showGroups = true, ordered = false }: { candidates: MapCandidate[]; groups: PlaceGroup[]; config: MapsConfig; showGroups?: boolean; ordered?: boolean }) {
  const [groupId, setGroupId] = useState("");
  const [requestedPage, setPage] = useState(0);
  const [visible, setVisible] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const [explorer] = useState(() => createMapExplorer((element, failed, signal, select) => startGoogleMap(element, config, failed, signal, select)));
  const state = useSyncExternalStore(explorer.subscribe, explorer.getSnapshot, () => initialExplorerState);
  useEffect(() => () => explorer.dispose(), [explorer]);
  const filtered = candidates.filter(row => !groupId || row.groupId === groupId);
  const page = Math.min(requestedPage, Math.max(0, Math.ceil(filtered.length / 20) - 1));
  const shown = filtered.slice(page * 20, page * 20 + 20);
  const busy = state.searching || state.phase === "loading";
  const available = config.enabled && config.placesEnabled && Boolean(config.apiKey && config.mapId);
  async function display() {
    setVisible(true);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (host.current) await explorer.loadSaved(host.current, shown.map(row => row.placeId));
  }
  return <section className="kk-saved-map" aria-label={ordered ? "この日の行き先の地図" : "保存した候補の地図"}>
    <div className="kk-section-heading"><h3>{ordered ? "この日の「ここいこ」マップ" : "みんなの行きたいを、地図で"}</h3><span className="kk-label">{filtered.length}件</span></div>
    {showGroups && groups.length > 1 && <label className="mt-3 block text-sm">表示するグループ<select aria-label="地図のグループ" value={groupId} disabled={busy} onChange={event => { setGroupId(event.target.value); setPage(0); setVisible(false); }} className="ml-2 min-h-11 rounded-xl border bg-white px-3"><option value="">すべてのグループ</option>{groups.map(group => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>}
    {!shown.length ? <p className="kk-map-note">場所が紐づいた候補はまだありません。検索結果から保存するか、候補詳細で場所を選んでください。</p> : <>
      <p className="kk-map-note">{ordered ? "ピンは場所ごとに表示します。訪問順は下の番号で確認できます。" : "場所を紐づけた通常の候補を表示します。"} 1回最大20件、表示するとGoogle Mapsから場所情報を取得します。</p>
      {available ? <button className="kk-secondary-link" type="button" disabled={busy || state.phase === "failed"} onClick={() => { void display(); }}>{busy ? "場所を読み込んでいます…" : visible ? "もう一度表示する" : "保存した場所を地図に表示"}</button> : <p className="kk-map-note">地図は準備中です。候補と道案内のリンクは使えます。</p>}
      {filtered.length > 20 && <div className="mt-3 flex items-center gap-3"><button type="button" className="kk-edit-button" disabled={busy || page === 0} onClick={() => { setPage(page - 1); setVisible(false); }}>← 前の20件</button><span>{page * 20 + 1}〜{Math.min((page + 1) * 20, filtered.length)}件</span><button type="button" className="kk-edit-button" disabled={busy || (page + 1) * 20 >= filtered.length} onClick={() => { setPage(page + 1); setVisible(false); }}>次の20件 →</button></div>}
    </>}
    <div ref={host} className="kk-google-map mt-3" hidden={!visible || !["ready", "loading"].includes(state.phase)} aria-label="保存した行き先のGoogleマップ" />
    {visible && state.error && <p role="alert" className="kk-map-error">{state.error}</p>}
    {visible && state.selected && <PlaceDetailPanel key={state.selected} place={state.results.find(row => row.id === state.selected)!} status={state.detailStatus} details={state.details} onRetry={() => { if (state.selected) void explorer.select(state.selected); }} />}
    <ol className="kk-saved-map-list">{shown.map((row, index) => <li key={`${row.itemId}-${index}`} data-selected={visible && row.placeId === state.selected}>
      <span className="kk-saved-map-number" aria-hidden="true">{row.stopNumber ?? page * 20 + index + 1}</span><div><Link className="font-semibold" href={`/app/groups/${row.groupId}/items/${row.itemId}`}>{row.title}</Link><small className="block text-stone-600">{groups.find(group => group.id === row.groupId)?.name}</small>{visible && state.results.find(place => place.id === row.placeId) && <p className="text-xs text-stone-500">{state.results.find(place => place.id === row.placeId)!.name}</p>}</div>
      <div className="flex flex-wrap gap-3">{visible && state.results.some(place => place.id === row.placeId) && <button type="button" className="kk-edit-button" onClick={() => { void explorer.select(row.placeId); }}>地図・写真</button>}<a className="kk-edit-button" target="_blank" rel="noopener noreferrer" href={directionsHref(row.placeId, row.title)}>道案内 ↗</a></div>
    </li>)}</ol>
  </section>;
}
