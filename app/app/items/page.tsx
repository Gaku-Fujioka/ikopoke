"use client";

import Link from "next/link";
import { ScreenState } from "@/components/flow/screen-state";
import { useMockSnapshot } from "@/components/flow/use-mock-snapshot";

export default function ItemsPage() {
  const { snapshot, error, loading, reload } = useMockSnapshot();

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

      <ScreenState loading={loading} error={error} onRetry={reload} />

      {snapshot && (snapshot.items.length === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-8">
          <h2 className="text-xl font-semibold">候補がまだありません</h2>
          <p className="mt-2 text-stone-600">まずは気になる場所や、やりたいことを一つ追加しましょう。</p>
          <Link href="/app/items/new" className="mt-5 inline-block font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">候補を追加する</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {snapshot.items.map((item) => (
            <li key={item.id}>
              <Link href={`/app/items/${encodeURIComponent(item.id)}`} className="group block h-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">
                <span className="inline-block rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{item.kind === "spot" ? "場所" : "やりたいこと"}</span>
                <h2 className="mt-4 text-xl font-semibold group-hover:text-orange-700">{item.title}</h2>
                <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-stone-600">{item.note || "メモはまだありません"}</p>
                <p className="mt-4 text-sm font-semibold text-orange-700">詳細を見る →</p>
              </Link>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
