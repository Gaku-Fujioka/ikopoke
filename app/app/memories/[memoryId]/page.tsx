"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, Suspense, useRef, useState } from "react";
import { ScreenState } from "@/components/flow/screen-state";
import { messageFromError, useMockSnapshot } from "@/components/flow/use-mock-snapshot";
import type { Memory } from "@/lib/kokoiko/contracts";
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
          <div>
            <p className="text-sm font-semibold tracking-widest text-orange-700">思い出 · デモ</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">{memory.title}</h1>
            <p className="mt-3 text-sm text-stone-600">{outing?.date ?? "日付未定"}</p>
          </div>
          <div className="flex aspect-[16/9] items-center justify-center rounded-3xl bg-gradient-to-br from-orange-100 to-stone-200 text-sm text-stone-600" role="img" aria-label="写真はまだありません">写真はまだありません</div>
          <section aria-labelledby="memory-places" className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
            <h2 id="memory-places" className="text-xl font-semibold">訪問を記録した候補</h2>
            {memory.itemTitles.length > 0 ? (
              <ol className="mt-4 list-inside list-decimal space-y-3 text-stone-700">
                {memory.itemTitles.map((title, index) => (
                  <li key={`${index}-${title}`}>
                    <span className="font-medium">{title}</span>
                    {visits[index]?.note && <p className="ml-5 mt-1 whitespace-pre-wrap text-sm text-stone-600">{visits[index].note}</p>}
                  </li>
                ))}
              </ol>
            ) : <p className="mt-3 text-stone-600">訪問記録はありません。</p>}
          </section>
          <section aria-labelledby="memory-note" className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
            <h2 id="memory-note" className="text-xl font-semibold">メモ</h2>
            <p className="mt-3 whitespace-pre-wrap leading-7 text-stone-700">{memory.note || "メモはまだありません。"}</p>
          </section>
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
