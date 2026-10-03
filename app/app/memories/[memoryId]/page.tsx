"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { ScreenState } from "@/components/flow/screen-state";
import { useMockSnapshot } from "@/components/flow/use-mock-snapshot";

function MemoryDetailContent() {
  const { memoryId } = useParams<{ memoryId: string }>();
  const { snapshot, error, loading, reload } = useMockSnapshot();
  const memory = snapshot?.memories.find((entry) => entry.id === memoryId);
  const outing = snapshot?.outings.find((entry) => entry.id === memory?.outingId);

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <Link href="/app/memories" className="text-sm font-semibold text-stone-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">← 思い出一覧へ</Link>
      <ScreenState loading={loading} error={error} onRetry={reload} />
      {!loading && !error && !memory && (
        <div className="rounded-3xl border border-stone-200 bg-white p-8"><h1 className="text-2xl font-semibold">思い出が見つかりません</h1><p className="mt-2 text-stone-600">URLを確認してください。</p></div>
      )}
      {memory && (
        <article className="space-y-7">
          <div>
            <p className="text-sm font-semibold tracking-widest text-orange-700">思い出 · デモ</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">{memory.title}</h1>
            <p className="mt-3 text-sm text-stone-600">{outing?.date ?? "日付未定"}</p>
          </div>
          <div className="flex aspect-[16/9] items-center justify-center rounded-3xl bg-gradient-to-br from-orange-100 to-stone-200 text-sm text-stone-600" role="img" aria-label="写真はまだありません">写真はまだありません</div>
          <section aria-labelledby="memory-places" className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
            <h2 id="memory-places" className="text-xl font-semibold">この日の候補</h2>
            {memory.itemTitles.length > 0 ? (
              <ol className="mt-4 list-inside list-decimal space-y-2 text-stone-700">
                {memory.itemTitles.map((title, index) => <li key={`${index}-${title}`}>{title}</li>)}
              </ol>
            ) : <p className="mt-3 text-stone-600">候補の登録はありません。</p>}
          </section>
          <section aria-labelledby="memory-note" className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
            <h2 id="memory-note" className="text-xl font-semibold">メモ</h2>
            <p className="mt-3 whitespace-pre-wrap leading-7 text-stone-700">{memory.note || "メモはまだありません。"}</p>
          </section>
          <p className="text-sm leading-6 text-stone-600">この思い出は計画の内容をローカル保存したデモです。訪問記録・写真・編集・他の人との共有はできません。</p>
          {outing && <Link href={`/app/outings/${encodeURIComponent(outing.id)}`} className="inline-block font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">元のおでかけを見る</Link>}
        </article>
      )}
    </div>
  );
}

export default function MemoryDetailPage() {
  return <Suspense fallback={<p role="status">思い出を読み込んでいます…</p>}><MemoryDetailContent /></Suspense>;
}
