"use client";

import Link from "next/link";
import { ScreenState } from "@/components/flow/screen-state";
import { useMockSnapshot } from "@/components/flow/use-mock-snapshot";
import type { Outing } from "@/lib/kokoiko/contracts";

function OutingCard({ outing }: { outing: Outing }) {
  return (
    <li className="min-w-0">
      <Link href={`/app/outings/${encodeURIComponent(outing.id)}`} className="block h-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">
        <h3 className="break-words text-xl font-semibold">{outing.title}</h3>
        <p className="mt-3 text-sm leading-6 text-stone-600">{outing.date ?? "日付未定"} · 候補{outing.itemIds.length}件</p>
        <p className="mt-4 text-sm font-semibold text-orange-700">{outing.status === "completed" ? "記録を見る" : "計画を見る"} →</p>
      </Link>
    </li>
  );
}

export default function OutingsPage() {
  const { snapshot, error, loading, reload } = useMockSnapshot();
  const planningOutings = snapshot?.outings.filter((outing) => outing.status === "planning") ?? [];
  const completedOutings = snapshot?.outings.filter((outing) => outing.status === "completed") ?? [];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-widest text-orange-700">おでかけ</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">次のおでかけを考えよう</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">計画はこのブラウザのデモデータに保存されます。</p>
        </div>
        <Link href="/app/outings/new" className="inline-flex min-h-11 items-center rounded-full bg-orange-700 px-6 text-sm font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">おでかけを作る</Link>
      </div>
      <ScreenState loading={loading} error={error} onRetry={reload} />
      {snapshot && (
        <div className="space-y-10">
          <section aria-labelledby="planning-outings-title" className="space-y-4">
            <h2 id="planning-outings-title" className="text-2xl font-bold">計画中（{planningOutings.length}件）</h2>
            {planningOutings.length === 0 ? (
              <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
                <p className="font-semibold">計画中のおでかけはありません</p>
                <p className="mt-2 text-sm leading-6 text-stone-600">行きたい候補を見ながら、次のおでかけを作りましょう。</p>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
                  <Link href="/app/outings/new" className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">おでかけを作る</Link>
                  <Link href="/app/items" className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">行きたい候補を見る</Link>
                </div>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {planningOutings.map((outing) => <OutingCard key={outing.id} outing={outing} />)}
              </ul>
            )}
          </section>
          <section aria-labelledby="completed-outings-title" className="space-y-4">
            <h2 id="completed-outings-title" className="text-2xl font-bold">終了済み（{completedOutings.length}件）</h2>
            {completedOutings.length === 0 ? (
              <p className="rounded-3xl border border-stone-200 bg-white p-6 text-sm text-stone-600 sm:p-8">終了したおでかけはまだありません。</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {completedOutings.map((outing) => <OutingCard key={outing.id} outing={outing} />)}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
