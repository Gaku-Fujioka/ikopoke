"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { ScreenState } from "@/components/flow/screen-state";
import { messageFromError, useMockSnapshot } from "@/components/flow/use-mock-snapshot";
import { createMockRepository, MOCK_GROUP_ID } from "@/lib/kokoiko/mock-repository";

function OutingDetailContent() {
  const { outingId } = useParams<{ outingId: string }>();
  const router = useRouter();
  const { snapshot, error, loading, reload } = useMockSnapshot();
  const [selectedItemId, setSelectedItemId] = useState("");
  const [visitNotes, setVisitNotes] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const outing = snapshot?.outings.find((entry) => entry.id === outingId);
  const availableItems = snapshot?.items.filter((entry) => !outing?.itemIds.includes(entry.id)) ?? [];
  const memory = snapshot?.memories.find((entry) => entry.outingId === outingId);
  const visits = snapshot?.visits.filter((entry) => entry.outingId === outingId) ?? [];

  function addItem() {
    if (!outing || !selectedItemId || saving) return;
    setSaving(true);
    setActionError(null);
    setSuccess("");
    try {
      createMockRepository(window.localStorage).addItemToOuting(MOCK_GROUP_ID, outing.id, selectedItemId);
      setSelectedItemId("");
      reload();
      setSuccess("候補を計画に追加しました。");
    } catch (cause) {
      setActionError(messageFromError(cause));
    } finally {
      setSaving(false);
    }
  }

  function complete() {
    if (!outing || saving) return;
    setSaving(true);
    setActionError(null);
    setSuccess("");
    try {
      const created = createMockRepository(window.localStorage).completeOuting(MOCK_GROUP_ID, outing.id);
      router.push(`/app/memories/${encodeURIComponent(created.id)}`);
    } catch (cause) {
      setActionError(messageFromError(cause));
      setSaving(false);
    }
  }

  function recordVisit(itemId: string) {
    if (!outing || saving) return;
    setSaving(true);
    setActionError(null);
    setSuccess("");
    try {
      createMockRepository(window.localStorage).recordVisit(MOCK_GROUP_ID, outing.id, itemId, visitNotes[itemId]);
      reload();
      setSuccess("訪問を記録しました。");
    } catch (cause) {
      setActionError(messageFromError(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <Link href="/app/outings" className="text-sm font-semibold text-stone-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">← おでかけ一覧へ</Link>
      <ScreenState loading={loading} error={error} onRetry={reload} />
      {!loading && !error && !outing && (
        <div className="rounded-3xl border border-stone-200 bg-white p-8"><h1 className="text-2xl font-semibold">おでかけが見つかりません</h1><p className="mt-2 text-stone-600">URLを確認してください。</p></div>
      )}
      {outing && (
        <>
          <div>
            <p className="text-sm font-semibold tracking-widest text-orange-700">{outing.status === "completed" ? "終了したおでかけ" : "計画中のおでかけ"}</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">{outing.title}</h1>
            <p className="mt-3 text-stone-600">{outing.date ?? "日付未定"}</p>
            {outing.note && <p className="mt-4 leading-7 text-stone-700">{outing.note}</p>}
          </div>
          <section aria-labelledby="plan-items-title" className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
            <h2 id="plan-items-title" className="text-xl font-semibold">計画の候補</h2>
            {outing.itemIds.length === 0 ? (
              <p className="mt-4 text-stone-600">候補はまだありません。</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {outing.itemIds.map((id, index) => {
                  const item = snapshot?.items.find((entry) => entry.id === id);
                  const visit = visits.find((entry) => entry.itemId === id);
                  return (
                    <li key={id} className="rounded-2xl bg-stone-50 p-4">
                      <div className="flex items-center gap-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-700 text-sm font-semibold text-white">{index + 1}</span>
                        {item ? <Link href={`/app/items/${encodeURIComponent(id)}`} className="font-semibold text-stone-900 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">{item.title}</Link> : <span className="text-stone-600">見つからない候補</span>}
                      </div>
                      {visit ? (
                        <div className="mt-3 pl-12 text-sm text-green-800">
                          <p className="font-semibold">訪問を記録済み</p>
                          {visit.note && <p className="mt-1 whitespace-pre-wrap text-stone-600">{visit.note}</p>}
                        </div>
                      ) : outing.status === "planning" && item ? (
                        <div className="mt-3 space-y-2 pl-12">
                          <label htmlFor={`visit-note-${id}`} className="block text-xs font-medium text-stone-600">訪問メモ（任意）</label>
                          <textarea id={`visit-note-${id}`} value={visitNotes[id] ?? ""} onChange={(event) => setVisitNotes((current) => ({ ...current, [id]: event.target.value }))} rows={2} className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700" />
                          <button type="button" disabled={saving} onClick={() => recordVisit(id)} className="min-h-11 rounded-full border border-orange-700 px-5 text-sm font-semibold text-orange-700 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:opacity-60">この候補の訪問を記録</button>
                        </div>
                      ) : <p className="mt-2 pl-12 text-sm text-stone-600">訪問記録なし</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          {outing.status === "planning" ? (
            <section aria-labelledby="add-item-title" className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
              <h2 id="add-item-title" className="text-xl font-semibold">候補を追加</h2>
              {availableItems.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  <label htmlFor="add-item" className="sr-only">追加する候補</label>
                  <select id="add-item" value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)} className="min-h-11 min-w-48 flex-1 rounded-xl border border-stone-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">
                    <option value="">追加する候補を選択</option>
                    {availableItems.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                  <button type="button" disabled={!selectedItemId || saving} onClick={addItem} className="min-h-11 rounded-full bg-orange-700 px-5 text-sm font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:opacity-60">追加する</button>
                </div>
              ) : <p className="text-sm text-stone-600">追加できる候補はありません。行きたい一覧から候補を作成できます。</p>}
              <Link href="/app/items/new" className="inline-block text-sm font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">新しい候補を作る</Link>
              <div className="border-t border-stone-200 pt-5">
                <p className="mb-4 text-sm leading-6 text-stone-600">記録した訪問だけを思い出に残します。未訪問の候補は訪問扱いになりません。写真・評価はこのデモでは記録できません。</p>
                <button type="button" disabled={saving} onClick={complete} className="min-h-12 w-full rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:opacity-60">{saving ? "終了中…" : "おでかけを終了して思い出を見る"}</button>
              </div>
              {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
              {success && <p role="status" className="text-sm text-green-800">{success}</p>}
            </section>
          ) : memory ? (
            <Link href={`/app/memories/${encodeURIComponent(memory.id)}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">この日の思い出を見る</Link>
          ) : <p className="text-sm text-stone-600">思い出を読み込めません。再読込してください。</p>}
        </>
      )}
    </div>
  );
}

export default function OutingDetailPage() {
  return <Suspense fallback={<p role="status">おでかけを読み込んでいます…</p>}><OutingDetailContent /></Suspense>;
}
