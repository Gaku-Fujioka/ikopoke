"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, Map, MapPin, Search, Sparkles } from "lucide-react";
import { createMapExplorer, googleMapsPlaceHref, initialExplorerState, type PlaceResult } from "@/lib/maps/explorer";
import { startGoogleMap, type MapsConfig } from "@/lib/maps/google";
import { PlaceDetailPanel } from "./place-detail-panel";

export function PlaceExplorer({ config, addHref, renderPlaceAction }: { config: MapsConfig; addHref: string; renderPlaceAction?: (place: PlaceResult, query: string) => ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [explorer] = useState(() => createMapExplorer((element, onFailure, signal, onSelect) => startGoogleMap(element, config, onFailure, signal, onSelect)));
  const state = useSyncExternalStore(explorer.subscribe, explorer.getSnapshot, () => initialExplorerState);
  useEffect(() => () => explorer.dispose(), [explorer]);
  const available = config.enabled && Boolean(config.apiKey) && Boolean(config.mapId);
  const busy = state.phase === "loading" || state.searching;
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (host.current && available && config.placesEnabled) void explorer.searchOnMap(host.current, query);
  }
  return <div className="kk-place-explorer">
    {available && config.placesEnabled && state.phase !== "failed" && <div className="kk-new-place-search">
      <h3>新しい場所を探す</h3><p>街やお店をGoogleマップから見つけよう。</p>
      <form onSubmit={search} role="search" aria-label="新しい場所を検索" className="kk-map-search">
        <Search aria-hidden="true" size={18} /><label htmlFor={searchId} className="sr-only">新しい場所の名前やエリア</label>
        <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} placeholder="例：吉祥寺 カフェ" required disabled={busy} />
        <button type="submit" disabled={busy}>{busy ? "検索中" : "場所を検索"}</button>
      </form>
    </div>}
    {state.phase === "closed" && <div className="kk-map-unconnected">
      <span className="kk-map-doodle" aria-hidden="true"><Map size={48} strokeWidth={1.3} /><Sparkles size={20} /></span>
      <strong>次の「ここいこ」を、見つけよう。</strong>
      <p>{available ? "地図をひらいて、気になる街やお店へ。" : "地図は準備中。いまは名前だけでも残しておこう。"}</p>
      {available ? <><button type="button" className="kk-primary-link" onClick={() => { if (host.current) void explorer.open(host.current); }}><MapPin size={17} aria-hidden="true" />地図をひらく</button><small>ひらくとGoogle Mapsに接続します。</small></> : <Link href={addHref} className="kk-primary-link">行きたいを追加</Link>}
    </div>}
    {/* Kept mounted while ready/searching so searches never recreate the map. */}
    <div ref={host} className="kk-google-map" hidden={state.phase !== "loading" && state.phase !== "ready"} aria-label="新しい行き先を探すGoogleマップ" />
    {state.phase === "loading" && <p role="status" className="kk-map-note">地図をひらいています…</p>}
    {state.phase === "ready" && <>
      {!config.placesEnabled && <p className="kk-map-note">新しい場所の検索は準備中です。保存した候補の検索・手入力を使えます。</p>}
      {state.searching && <p role="status" className="kk-map-note">気になる場所を探しています…</p>}
      {state.searched !== null && <p role="status" className="kk-map-note">「{state.searched}」{state.results.length ? `の検索結果 · ${state.results.length}件` : "に合う場所が見つかりませんでした。エリアや名前を変えてみてください。"}</p>}
      {state.selected && <PlaceDetailPanel key={state.selected} place={state.results.find(place => place.id === state.selected)!} details={state.details} status={state.detailStatus} onRetry={() => { if (state.selected) void explorer.select(state.selected); }} />}
      {state.selected && renderPlaceAction?.(state.results.find(place => place.id === state.selected)!, state.searched ?? "")}
      {state.results.length > 0 && <><ul className="kk-place-results" aria-label="Google Mapsの検索結果">{state.results.map(place => <li key={place.id} data-selected={state.selected === place.id}>
        <button type="button" className="kk-place-select" aria-pressed={state.selected === place.id} onClick={() => { void explorer.select(place.id); }}><MapPin size={18} aria-hidden="true" /><span><strong>{place.name}</strong><small>{place.address}</small></span><span className="kk-place-show">{state.selected === place.id ? "選択中" : "写真・口コミ"}</span></button>
        <a className="kk-place-external" href={googleMapsPlaceHref(place)} target="_blank" rel="noopener noreferrer">Googleマップで詳しく見る <ExternalLink size={13} aria-hidden="true" /><span className="sr-only">（新しいタブ）</span></a>
        {place.attributions.length > 0 && <p className="kk-place-attribution">{place.attributions.map((attribution, index) => <span key={index}>{attribution.uri ? <a href={attribution.uri} target="_blank" rel="noopener noreferrer">{attribution.name}</a> : attribution.name}{index < place.attributions.length - 1 ? " · " : ""}</span>)}</p>}
      </li>)}</ul><p className="kk-map-note">{renderPlaceAction ? "気になる場所を選んだら、そのまま行きたいへ。" : "気になる場所は、名前をつけて「行きたい」に残そう。地図の場所や住所は保存されません。"}</p></>}
      <div className="kk-map-footer"><Link href={addHref} className="kk-secondary-link">名前を入力して候補に追加</Link><span>場所情報：Google Maps</span></div>
    </>}
    {state.error && <div className="kk-map-error" role="alert"><p>{state.error}</p>{state.phase === "failed" && <Link href={addHref} className="kk-text-link">手入力で候補を追加 →</Link>}</div>}
  </div>;
}
