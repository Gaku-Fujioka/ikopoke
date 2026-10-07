"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { ScreenState } from "@/components/flow/screen-state";
import { messageFromError, useMockSnapshot } from "@/components/flow/use-mock-snapshot";
import type { Memory, Visit } from "@/lib/kokoiko/contracts";
import { createMockRepository, MOCK_GROUP_ID } from "@/lib/kokoiko/mock-repository";

function MemoryEditForm({ memory, reload }: { memory: Memory; reload: () => void }) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [title, setTitle] = useState(memory.title);
  const [note, setNote] = useState(memory.note);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const titleError = error === "名前を入力してください。";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!title.trim()) {
      setError("名前を入力してください。");
      setSuccess("");
      titleInputRef.current?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError(null);
    setSuccess("");
    try {
      const updated = createMockRepository(window.localStorage).updateMemory(MOCK_GROUP_ID, memory.id, { title, note });
      setTitle(updated.title);
      setNote(updated.note);
      reload();
      setSuccess("思い出を保存しました。");
    } catch (cause) {
      setError(messageFromError(cause));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="memory-edit" className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <h2 id="memory-edit" className="text-xl font-semibold">思い出を編集</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">タイトルとメモをこのブラウザに保存できます。訪問先の記録はそのまま残ります。</p>
      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
        <div className="space-y-2">
          <label htmlFor="memory-title" className="block text-sm font-semibold">タイトル <span className="text-orange-700">必須</span></label>
          <input ref={titleInputRef} id="memory-title" value={title} onChange={(event) => { setTitle(event.target.value); if (titleError) setError(null); setSuccess(""); }} aria-required="true" aria-invalid={titleError} aria-describedby={titleError ? "memory-title-error" : undefined} className="min-h-12 w-full rounded-xl border border-stone-300 px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700" />
          {titleError && <p id="memory-title-error" role="alert" className="text-sm font-medium text-red-700">{error}</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="memory-note-input" className="block text-sm font-semibold">メモ <span className="font-normal text-stone-500">任意</span></label>
          <textarea id="memory-note-input" value={note} onChange={(event) => { setNote(event.target.value); setSuccess(""); }} rows={4} className="w-full rounded-xl border border-stone-300 px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700" />
        </div>
        {error && !titleError && <p role="alert" className="text-sm font-medium text-red-700">保存できませんでした：{error}</p>}
        {success && <p role="status" className="text-sm font-medium text-green-800">{success}</p>}
        <button type="submit" disabled={saving} className="min-h-12 rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{saving ? "保存中…" : "思い出を保存"}</button>
      </form>
    </section>
  );
}

function MemoryBook({ memory, date, visits }: { memory: Memory; date: string | null; visits: Visit[] }) {
  const [page, setPage] = useState(0);
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasChangedPage = useRef(false);
  const chapterCount = memory.itemTitles.length;
  const lastPage = chapterCount + 2;
  const pageLabel = page === 0 ? "表紙" : page === 1 ? "目次" : page === lastPage ? "あとがき" : `第${page - 1}章`;

  useEffect(() => {
    if (hasChangedPage.current) pageHeadingRef.current?.focus();
  }, [page]);

  function turnTo(nextPage: number) {
    if (nextPage < 0 || nextPage > lastPage || nextPage === page) return;
    hasChangedPage.current = true;
    setPage(nextPage);
  }

  return (
    <section aria-label={`${memory.title}の思い出の本`} className="space-y-4">
      <div className="min-h-[25rem] overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm sm:min-h-[30rem]">
        <div className="flex min-h-[25rem] flex-col border-l-[10px] border-orange-200 px-6 py-8 sm:min-h-[30rem] sm:border-l-[14px] sm:px-12 sm:py-12">
          {page === 0 ? (
            <div className="flex flex-1 flex-col justify-between gap-10">
              <div>
                <p className="text-xs font-semibold tracking-[0.3em] text-orange-700">ここいこ · 思い出の一冊</p>
                <div aria-hidden="true" className="mt-12 h-16 w-16 rounded-full bg-orange-100 ring-8 ring-orange-50 sm:mt-16" />
                <h1 ref={pageHeadingRef} tabIndex={-1} className="mt-8 break-words text-4xl font-bold leading-tight tracking-tight outline-none sm:text-6xl">{memory.title}</h1>
              </div>
              <div className="border-t border-stone-200 pt-5 text-sm leading-7 text-stone-600">
                <p>{date ? <time dateTime={date}>{date}</time> : "日付未定"}</p>
                <p>訪問の記録 {chapterCount}件</p>
              </div>
            </div>
          ) : page === 1 ? (
            <div className="flex-1">
              <p className="text-xs font-semibold tracking-[0.3em] text-orange-700">CONTENTS</p>
              <h1 ref={pageHeadingRef} tabIndex={-1} className="mt-4 text-4xl font-bold tracking-tight outline-none">目次</h1>
              {chapterCount === 0 ? (
                <p className="mt-10 leading-7 text-stone-600">訪問先の記録はまだありません。あとがきへ進むと、この日のメモを読めます。</p>
              ) : (
                <ol className="mt-9 divide-y divide-stone-200 border-y border-stone-200">
                  {memory.itemTitles.map((title, index) => (
                    <li key={`${index}-${title}`}>
                      <button type="button" onClick={() => turnTo(index + 2)} className="flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left hover:text-orange-700 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">
                        <span className="min-w-0 break-words font-semibold"><span className="mr-4 text-sm text-orange-700">{String(index + 1).padStart(2, "0")}</span>{title}</span>
                        <span aria-hidden="true" className="shrink-0 text-orange-700">→</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <button type="button" onClick={() => turnTo(lastPage)} className="mt-5 inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">あとがきを読む →</button>
            </div>
          ) : page === lastPage ? (
            <div className="flex flex-1 flex-col">
              <p className="text-xs font-semibold tracking-[0.3em] text-orange-700">AFTERWORD</p>
              <h1 ref={pageHeadingRef} tabIndex={-1} className="mt-4 text-4xl font-bold tracking-tight outline-none">あとがき</h1>
              <p className="mt-10 whitespace-pre-wrap break-words text-lg leading-9 text-stone-700">{memory.note || "この日のメモはまだありません。"}</p>
              <a href="#memory-edit" className="mt-auto inline-flex min-h-11 items-center self-start pt-8 font-semibold text-orange-700 underline underline-offset-4 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">タイトルとメモを編集する</a>
            </div>
          ) : (
            <div className="flex-1">
              <p className="text-xs font-semibold tracking-[0.3em] text-orange-700">CHAPTER {String(page - 1).padStart(2, "0")}</p>
              <h1 ref={pageHeadingRef} tabIndex={-1} className="mt-4 break-words text-3xl font-bold leading-tight tracking-tight outline-none sm:text-5xl">{memory.itemTitles[page - 2]}</h1>
              <div aria-hidden="true" className="mt-8 h-1 w-12 rounded-full bg-orange-600" />
              <p className="mt-10 whitespace-pre-wrap break-words text-lg leading-9 text-stone-700">{visits[page - 2]?.note || "この場所のメモはまだありません。"}</p>
              <p className="mt-8 text-sm text-stone-500">写真はまだありません</p>
            </div>
          )}
        </div>
      </div>

      <nav aria-label="思い出のページ移動" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 sm:px-6">
        <button type="button" onClick={() => turnTo(page - 1)} disabled={page === 0} className="min-h-11 rounded-full px-3 font-semibold text-orange-700 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:cursor-not-allowed disabled:text-stone-400 disabled:hover:bg-transparent">← 前のページ</button>
        <p aria-live="polite" aria-atomic="true" className="order-first w-full text-center text-sm font-medium text-stone-600 sm:order-none sm:w-auto">{pageLabel} · {page + 1} / {lastPage + 1}</p>
        <button type="button" onClick={() => turnTo(page + 1)} disabled={page === lastPage} className="min-h-11 rounded-full px-3 font-semibold text-orange-700 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:cursor-not-allowed disabled:text-stone-400 disabled:hover:bg-transparent">次のページ →</button>
      </nav>
      {page > 1 && <button type="button" onClick={() => turnTo(1)} className="min-h-11 rounded-full px-3 text-sm font-semibold text-stone-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">目次に戻る</button>}
    </section>
  );
}

function MemoryDetailContent() {
  const { memoryId } = useParams<{ memoryId: string }>();
  const { snapshot, error, loading, reload } = useMockSnapshot();
  const memory = snapshot?.memories.find((entry) => entry.id === memoryId);
  const outing = snapshot?.outings.find((entry) => entry.id === memory?.outingId);
  const visits = snapshot?.visits.filter((entry) => entry.outingId === memory?.outingId) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <Link href="/app/memories" className="text-sm font-semibold text-stone-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">← 思い出一覧へ</Link>
      <ScreenState loading={loading} error={error} onRetry={reload} />
      {!loading && !error && !memory && (
        <div className="rounded-3xl border border-stone-200 bg-white p-8"><h1 className="text-2xl font-semibold">思い出が見つかりません</h1><p className="mt-2 text-stone-600">URLを確認してください。</p></div>
      )}
      {memory && (
        <article className="space-y-7">
          <MemoryBook key={memory.id} memory={memory} date={outing?.date ?? null} visits={visits} />
          <MemoryEditForm key={memory.id} memory={memory} reload={reload} />
          <p className="text-sm leading-6 text-stone-600">この思い出は記録した訪問先をローカル保存したデモです。写真・他の人との共有はできません。</p>
          {outing && <Link href={`/app/outings/${encodeURIComponent(outing.id)}`} className="inline-block font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">元のおでかけを見る</Link>}
        </article>
      )}
    </div>
  );
}

export default function MemoryDetailPage() {
  return <Suspense fallback={<p role="status">思い出を読み込んでいます…</p>}><MemoryDetailContent /></Suspense>;
}
