"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ScreenState } from "@/components/flow/screen-state";
import { useMockSnapshot } from "@/components/flow/use-mock-snapshot";
import type { ItemKind } from "@/lib/kokoiko/contracts";
import { itemDetailHref, itemKindFromQuery, itemListHref, reactionFromQuery, type ReactionFilter } from "@/lib/kokoiko/item-list-query";
import { MOCK_MEMBER_ID } from "@/lib/kokoiko/mock-repository";
import { REACTION_OPTIONS, reactionLabel as savedReactionLabel } from "@/lib/items/reaction-values";

const kinds: { label: string; value: ItemKind | null }[] = [
  { label: "すべて", value: null },
  { label: "場所", value: "spot" },
  { label: "やりたいこと", value: "activity" },
];
const reactions: { label: string; value: ReactionFilter | null }[] = [
  { label: "すべて", value: null },
  ...REACTION_OPTIONS,
  { label: "未反応", value: "none" },
];

function ItemsContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const kind = itemKindFromQuery(searchParams.get("kind"));
  const reaction = reactionFromQuery(searchParams.get("reaction"));
  const kindLabel = kind === "spot" ? "場所" : kind === "activity" ? "やりたいこと" : null;
  const reactionLabel = reaction ? reactions.find((option) => option.value === reaction)?.label : null;
  const { snapshot, error, loading, reload } = useMockSnapshot();
  const items = snapshot?.items.filter((item) =>
    (!kind || item.kind === kind) &&
    (!reaction || (reaction === "none" ? !item.reactions[MOCK_MEMBER_ID] : item.reactions[MOCK_MEMBER_ID] === reaction)) &&
    item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  ) ?? [];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-widest text-orange-700">行きたい</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">次はどこへ行こう？</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">このブラウザに保存した候補です。他の人とは共有されません。</p>
        </div>
        <Link href="/app/items/new" className="inline-flex min-h-11 items-center rounded-full bg-orange-700 px-6 text-sm font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">候補を追加</Link>
      </div>

      <form action="/app/items" method="get" role="search" className="flex flex-wrap items-end gap-3 rounded-3xl border border-stone-200 bg-white p-4 sm:p-5">
        {kind && <input type="hidden" name="kind" value={kind} />}
        {reaction && <input type="hidden" name="reaction" value={reaction} />}
        <div className="min-w-48 flex-1 space-y-2">
          <label htmlFor="item-search" className="block text-sm font-semibold">候補の名前で検索</label>
          <input key={query} id="item-search" name="q" type="search" defaultValue={query} placeholder="行きたい場所や、やりたいこと" className="min-h-11 w-full rounded-xl border border-stone-300 px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700" />
        </div>
        <button type="submit" className="min-h-11 rounded-full bg-stone-900 px-6 text-sm font-semibold text-white hover:bg-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2">検索</button>
        {(query || kind || reaction) && <Link href="/app/items" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">条件を解除</Link>}
      </form>

      <nav aria-label="候補の種類" className="flex flex-wrap gap-2">
        {kinds.map((option) => {
          const active = kind === option.value;
          return (
            <Link key={option.label} href={itemListHref(query, option.value, reaction)} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 ${active ? "border-orange-700 bg-orange-50 text-orange-800" : "border-stone-300 bg-white text-stone-700 hover:border-orange-300"}`}>
              {option.label}
            </Link>
          );
        })}
      </nav>

      <nav aria-label="自分の反応" className="flex flex-wrap gap-2">
        {reactions.map((option) => {
          const active = reaction === option.value;
          return (
            <Link key={option.label} href={itemListHref(query, kind, option.value)} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 ${active ? "border-orange-700 bg-orange-50 text-orange-800" : "border-stone-300 bg-white text-stone-700 hover:border-orange-300"}`}>
              {option.label}
            </Link>
          );
        })}
      </nav>

      <ScreenState loading={loading} error={error} onRetry={reload} />

      {snapshot && (snapshot.items.length === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-8">
          <h2 className="text-xl font-semibold">候補がまだありません</h2>
          <p className="mt-2 text-stone-600">まずは気になる場所や、やりたいことを一つ追加しましょう。</p>
          <Link href="/app/items/new" className="mt-5 inline-block font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">候補を追加する</Link>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-8">
          <h2 className="text-xl font-semibold">{kind || reaction ? "条件に合う候補がありません" : "検索結果がありません"}</h2>
          <p className="mt-2 text-stone-600">{query ? `「${query}」に一致する` : ""}{kindLabel ? `${kindLabel}の` : ""}{reactionLabel ? `「${reactionLabel}」の` : ""}候補は見つかりませんでした。</p>
          <Link href="/app/items" className="mt-5 inline-block font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">条件を解除してすべて見る</Link>
        </div>
      ) : (
        <>
          {(query || kind || reaction) && <p role="status" className="text-sm text-stone-600">{query ? `「${query}」の` : ""}{kindLabel ? `${kindLabel}の` : ""}{reactionLabel ? `「${reactionLabel}」の` : ""}検索結果：{items.length}件</p>}
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={itemDetailHref(item.id, query, kind, reaction)} className="group block h-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">
                  <span className="inline-block rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{item.kind === "spot" ? "場所" : "やりたいこと"}</span>
                  <h2 className="mt-4 text-xl font-semibold group-hover:text-orange-700">{item.title}</h2>
                  <p className="mt-2 text-xs font-semibold text-stone-600">自分の反応：{savedReactionLabel(item.reactions[MOCK_MEMBER_ID] ?? null)}</p>
                  <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-stone-600">{item.note || "メモはまだありません"}</p>
                  <p className="mt-4 text-sm font-semibold text-orange-700">詳細を見る →</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ))}
    </div>
  );
}

export default function ItemsPage() {
  return <Suspense fallback={<p role="status">候補を読み込んでいます…</p>}><ItemsContent /></Suspense>;
}
