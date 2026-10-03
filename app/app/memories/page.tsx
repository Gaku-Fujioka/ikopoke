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
        <h1 className="mt-2 text-4xl font-bold tracking-tight">楽しかった日を見返そう</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">終了したデモ計画から作られた思い出です。このブラウザ以外には共有されません。</p>
      </div>
      <ScreenState loading={loading} error={error} onRetry={reload} />
      {snapshot && (snapshot.memories.length === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-8">
          <h2 className="text-xl font-semibold">思い出はまだありません</h2>
          <p className="mt-2 text-stone-600">おでかけを終了すると、ここに表示されます。</p>
          <Link href="/app/outings" className="mt-5 inline-block font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">おでかけを見る</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {snapshot.memories.map((memory) => (
            <li key={memory.id}>
              <Link href={`/app/memories/${encodeURIComponent(memory.id)}`} className="block h-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">
                <div aria-hidden="true" className="mb-5 flex aspect-[16/8] items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-stone-200 text-3xl text-orange-700">✳</div>
                <h2 className="text-xl font-semibold">{memory.title}</h2>
                <p className="mt-2 text-sm text-stone-600">{memory.itemTitles.length}件の候補</p>
                <p className="mt-4 text-sm font-semibold text-orange-700">思い出を見る →</p>
              </Link>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
