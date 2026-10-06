"use client";

import Link from "next/link";
import { ScreenState } from "@/components/flow/screen-state";
import { useMockSnapshot } from "@/components/flow/use-mock-snapshot";

export default function MemoriesPage() {
  const { snapshot, error, loading, reload } = useMockSnapshot();

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm font-semibold tracking-widest text-orange-700">思い出</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">楽しかった日を見返そう</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">終了したデモ計画から作られた思い出です。このブラウザ以外には共有されません。</p>
      </div>
      <ScreenState loading={loading} error={error} onRetry={reload} />
      {snapshot && (
        <section aria-labelledby="memories-title" className="space-y-4">
          <h2 id="memories-title" className="text-2xl font-bold">思い出（{snapshot.memories.length}件）</h2>
          {snapshot.memories.length === 0 ? (
            <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
              <p className="font-semibold">思い出はまだありません</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">おでかけを終了すると、ここに思い出ができます。記録した訪問先も一緒に見返せます。</p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                <Link href="/app/outings" className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">おでかけを見る</Link>
                <Link href="/app/outings/new" className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">おでかけを作る</Link>
              </div>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {snapshot.memories.map((memory) => {
                const outing = snapshot.outings.find((entry) => entry.id === memory.outingId);
                const visitCount = memory.itemTitles.length;
                return (
                  <li key={memory.id} className="min-w-0">
                    <Link href={`/app/memories/${encodeURIComponent(memory.id)}`} className="block h-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">
                      <h3 className="break-words text-xl font-semibold">{memory.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-stone-600">
                        {outing?.date ? <time dateTime={outing.date}>{outing.date}</time> : "日付未定"} · 訪問記録{visitCount}件
                      </p>
                      {visitCount > 0 ? (
                        <p className="mt-3 break-words text-sm leading-6 text-stone-700">
                          訪問先：{memory.itemTitles.slice(0, 2).join("、")}{visitCount > 2 && `、ほか${visitCount - 2}件`}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm leading-6 text-stone-600">訪問先の記録はありません。</p>
                      )}
                      <p className="mt-5 text-sm font-semibold text-orange-700">思い出を見る →</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
