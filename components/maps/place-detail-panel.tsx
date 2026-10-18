"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Star } from "lucide-react";
import { googleMapsPlaceHref, type PlaceAuthor, type PlaceDetails, type PlaceResult } from "@/lib/maps/explorer";

function GoogleImage({ uri, alt, avatar = false }: { uri: string; alt: string; avatar?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return avatar ? <span className="kk-google-avatar-fallback" aria-hidden="true">●</span> : <p className="kk-map-note">写真を表示できませんでした。下のリンクからGoogleマップでも確認できます。</p>;
  // Direct browser request: no copy or resize through Next's server/image cache.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={uri} alt={alt} width={avatar ? 32 : 800} height={avatar ? 32 : 480} loading="lazy" onError={() => setFailed(true)} className={avatar ? "kk-google-avatar" : "kk-google-place-photo"} />;
}
function Author({ author }: { author: PlaceAuthor }) {
  return <span className="kk-google-author">{author.avatar && <GoogleImage key={author.avatar} uri={author.avatar} alt="" avatar />}{author.uri ? <a href={author.uri} target="_blank" rel="noopener noreferrer">{author.name}<span className="sr-only">のGoogleマッププロフィール（新しいタブ）</span></a> : <span>{author.name}</span>}</span>;
}
function Rating({ rating, count }: { rating: number | null; count?: number | null }) {
  return rating !== null ? <span className="kk-google-rating"><Star size={15} fill="currentColor" aria-hidden="true" /><span>{rating.toFixed(1)} / 5</span>{count !== undefined && count !== null && <small>（{count.toLocaleString("ja-JP")}件の評価）</small>}</span> : <span className="kk-muted">評価は未掲載です</span>;
}
export function PlaceDetailPanel({ place, details, status, onRetry }: { place: PlaceResult; details: PlaceDetails | null; status: "idle" | "loading" | "ready" | "error"; onRetry(): void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); }, [place.id]);
  return <section ref={panel} tabIndex={-1} className="kk-google-place-detail" aria-label={`${place.name}の写真と口コミ`}>
    <div className="kk-google-detail-heading"><div><p>ここ、気になる！</p><h3>{place.name}</h3></div><a href={googleMapsPlaceHref(place)} target="_blank" rel="noopener noreferrer" aria-label={`${place.name}をGoogleマップで開く（新しいタブ）`}><ExternalLink size={18} aria-hidden="true" /></a></div>
    <p className="kk-google-address">{place.address}</p>
    {(status === "loading" || status === "idle") && <p role="status" className="kk-map-note">写真と口コミを読み込んでいます…</p>}
    {status === "error" && <div role="alert" className="kk-map-error"><p>写真と口コミを読み込めませんでした。地図と検索結果は引き続き使えます。</p><button type="button" className="kk-text-link min-h-11" onClick={onRetry}>もう一度読み込む</button></div>}
    {status === "ready" && details && <>
      <Rating rating={details.rating} count={details.ratingCount} />
      {details.photo ? <figure className="kk-google-photo"><GoogleImage key={details.photo.uri} uri={details.photo.uri} alt={`${place.name}のGoogleマップ掲載写真`} /><figcaption><div>{details.photo.authors.map((author, index) => <Author key={index} author={author} />)}</div><a href={details.photo.source} target="_blank" rel="noopener noreferrer">この写真をGoogleマップで見る ↗</a></figcaption></figure> : <p className="kk-map-note">ここで表示できる写真はありません。Googleマップでも確認できます。</p>}
      <div className="kk-google-review-heading"><h4>Googleマップの口コミ</h4><p>Googleが選んだ関連性順・最大5件。全件はGoogleマップへ。</p></div>
      {details.reviews.length ? <ul className="kk-google-reviews">{details.reviews.map((review, index) => <li key={index}>
        <div className="kk-google-review-author"><Author author={review.author} /><span>{review.relativeTime}</span></div><Rating rating={review.rating} />
        {review.text && <p className="kk-google-review-text">{review.text}</p>}
        {review.original && <><p className="kk-google-translation">Googleによる翻訳</p><details><summary>原文を見る</summary><p className="kk-google-review-text">{review.original}</p></details></>}
        <a className="kk-google-review-source" href={review.source} target="_blank" rel="noopener noreferrer">この口コミをGoogleマップで見る ↗</a>
      </li>)}</ul> : <p className="kk-map-note">ここで表示できる口コミはありません。Googleマップでも確認できます。</p>}
      {details.attributions.length > 0 && <p className="kk-place-attribution">{details.attributions.map((credit, index) => <span key={index}>{credit.uri ? <a href={credit.uri} target="_blank" rel="noopener noreferrer">{credit.name}</a> : credit.name}{index < details.attributions.length - 1 ? " · " : ""}</span>)}</p>}
    </>}
    <a className="kk-google-more" href={googleMapsPlaceHref(place)} target="_blank" rel="noopener noreferrer">Googleマップで写真・口コミをもっと見る <ExternalLink size={13} aria-hidden="true" /></a>
    <p className="kk-google-credit" lang="en">Google Maps</p>
  </section>;
}
