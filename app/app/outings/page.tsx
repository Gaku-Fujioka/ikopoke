"use client";

import Link from "next/link";
import { ScreenState } from "@/components/flow/screen-state";
import { useMockSnapshot } from "@/components/flow/use-mock-snapshot";

export default function OutingsPage() {
  const { snapshot, error, loading, reload } = useMockSnapshot();

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-widest text-orange-700">おでかけ</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">次のおでかけを考えよう</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">計画はこのブラウザのデモデータに保存されます。</p>
        </div>
        <Link href="/app/outings/new" className="inline-flex min-h-11 items-center rounded-full bg-orange-700 px-6 text-sm font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">おでかけを作る</Link>
      </div>
      <ScreenState loading={loading} error={error} onRetry={reload} />
      {snapshot && (snapshot.outings.length === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-8">
          <h2 className="text-xl font-semibold">計画はまだありません</h2>
          <p className="mt-2 text-stone-600">候補を選んで、最初のおでかけを作りましょう。</p>
          <Link href="/app/items" className="mt-5 inline-block font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">行きたい候補を見る</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {snapshot.outings.map((outing) => (
            <li key={outing.id}>
              <Link href={`/app/outings/${encodeURIComponent(outing.id)}`} className="block h-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">
                <span className="inline-block rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{outing.status === "completed" ? "終了" : "計画中"}</span>
                <h2 className="mt-4 text-xl font-semibold">{outing.title}</h2>
                <p className="mt-2 text-sm text-stone-600">{outing.date ?? "日付未定"} · {outing.itemIds.length}件の候補</p>
                <p className="mt-4 text-sm font-semibold text-orange-700">計画を見る →</p>
              </Link>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
