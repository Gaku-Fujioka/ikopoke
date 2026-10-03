"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ScreenState } from "@/components/flow/screen-state";
import { messageFromError, useMockSnapshot } from "@/components/flow/use-mock-snapshot";
import { createMockRepository, MOCK_GROUP_ID } from "@/lib/kokoiko/mock-repository";

export function NewOutingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialItemId = searchParams.get("itemId");
  const { snapshot, error: loadError, loading, reload } = useMockSnapshot();
  const submitting = useRef(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialItemId ? [initialItemId] : []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const validSelectedIds = selectedIds.filter((id) => snapshot?.items.some((item) => item.id === id));
  const hasUnknownSelection = Boolean(snapshot && validSelectedIds.length !== selectedIds.length);

  function toggleItem(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!title.trim()) {
      setError("おでかけの名前を入力してください。");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const outing = createMockRepository(window.localStorage).createOuting(MOCK_GROUP_ID, {
        title,
        date: date || null,
        note,
        itemIds: validSelectedIds,
      });
      router.push(`/app/outings/${encodeURIComponent(outing.id)}`);
    } catch (cause) {
      setError(messageFromError(cause));
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <Link href="/app/outings" className="text-sm font-semibold text-stone-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">← おでかけ一覧へ</Link>
      <div>
        <p className="text-sm font-semibold tracking-widest text-orange-700">新しいおでかけ</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">行く計画を作ろう</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">日付は後からでも大丈夫。デモ計画はこのブラウザにのみ保存されます。</p>
      </div>
      <ScreenState loading={loading} error={loadError} onRetry={reload} />
      {snapshot && (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-2">
            <label htmlFor="outing-title" className="block text-sm font-semibold">おでかけの名前 <span className="text-orange-700">必須</span></label>
            <input id="outing-title" value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(error && !title.trim())} className="min-h-12 w-full rounded-xl border border-stone-300 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700" placeholder="例：週末の鎌倉さんぽ" />
          </div>
          <div className="space-y-2">
            <label htmlFor="outing-date" className="block text-sm font-semibold">日付 <span className="font-normal text-stone-500">任意</span></label>
            <input id="outing-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-12 w-full rounded-xl border border-stone-300 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700" />
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">行きたい候補 <span className="font-normal text-stone-500">任意</span></legend>
            {hasUnknownSelection && <p role="status" className="text-sm text-stone-600">URLで指定された候補が見つからないため、選択から除外します。</p>}
            {snapshot.items.length === 0 ? (
              <p className="text-sm text-stone-600">候補はまだありません。先に作成するか、候補なしで計画できます。</p>
            ) : snapshot.items.map((item) => (
              <label key={item.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-stone-200 px-4 focus-within:ring-2 focus-within:ring-orange-700">
                <input type="checkbox" checked={validSelectedIds.includes(item.id)} onChange={() => toggleItem(item.id)} />
                <span>{item.title}</span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <label htmlFor="outing-note" className="block text-sm font-semibold">メモ <span className="font-normal text-stone-500">任意</span></label>
            <textarea id="outing-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="w-full rounded-xl border border-stone-300 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700" />
          </div>
          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
          <button type="submit" disabled={saving} className="min-h-12 w-full rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:opacity-60">{saving ? "保存中…" : "デモ計画を保存"}</button>
        </form>
      )}
    </div>
  );
}
