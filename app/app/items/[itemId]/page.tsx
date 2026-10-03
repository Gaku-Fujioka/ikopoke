"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ScreenState } from "@/components/flow/screen-state";
import { messageFromError, useMockSnapshot } from "@/components/flow/use-mock-snapshot";
import type { ReactionValue } from "@/lib/kokoiko/contracts";
import { createMockRepository, MOCK_GROUP_ID, MOCK_MEMBER_ID } from "@/lib/kokoiko/mock-repository";

function ItemDetailContent() {
  const { itemId } = useParams<{ itemId: string }>();
  const query = useSearchParams().get("q")?.trim() ?? "";
  const listHref = query ? `/app/items?q=${encodeURIComponent(query)}` : "/app/items";
  const { snapshot, error, loading, reload } = useMockSnapshot();
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const item = snapshot?.items.find((entry) => entry.id === itemId);
  const reaction = item?.reactions[MOCK_MEMBER_ID];

  function chooseReaction(value: ReactionValue) {
    if (!item || saving) return;
    setSaving(true);
    setActionError(null);
    setSuccess("");
    try {
      const next = reaction === value ? null : value;
      createMockRepository(window.localStorage).setReaction(MOCK_GROUP_ID, item.id, MOCK_MEMBER_ID, next);
      reload();
      setSuccess(next === null ? "反応を取り消しました。" : "反応を保存しました。");
    } catch (cause) {
      setActionError(messageFromError(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <Link href={listHref} className="text-sm font-semibold text-stone-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">← 行きたい一覧へ</Link>
      <ScreenState loading={loading} error={error} onRetry={reload} />
      {!loading && !error && !item && (
        <div className="rounded-3xl border border-stone-200 bg-white p-8">
          <h1 className="text-2xl font-semibold">候補が見つかりません</h1>
          <p className="mt-2 text-stone-600">削除されたか、URLが正しくない可能性があります。</p>
        </div>
      )}
      {item && (
        <>
          <div className="space-y-4">
            <div className="flex aspect-[16/8] items-center justify-center rounded-3xl bg-gradient-to-br from-orange-100 to-stone-200 text-sm text-stone-600" role="img" aria-label="写真はまだありません">写真はまだありません</div>
            <span className="inline-block rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{item.kind === "spot" ? "場所" : "やりたいこと"}</span>
            <h1 className="text-4xl font-bold tracking-tight">{item.title}</h1>
            <p className="leading-7 text-stone-600">{item.note || "メモはまだありません。"}</p>
          </div>
          <section aria-labelledby="reaction-title" className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
            <h2 id="reaction-title" className="text-xl font-semibold">あなたの気持ち</h2>
            <p className="mt-2 text-sm text-stone-600">現在の反応：{reaction === "want_to_go" ? "行きたい" : reaction === "not_now" ? "あんまり" : "未反応"}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {(["want_to_go", "not_now"] as const).map((value) => (
                <button key={value} type="button" disabled={saving} onClick={() => chooseReaction(value)} aria-pressed={reaction === value} className={`min-h-11 rounded-full border px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:opacity-60 ${reaction === value ? "border-orange-700 bg-orange-50 text-orange-800" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"}`}>{value === "want_to_go" ? "行きたい" : "あんまり"}</button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-stone-500">選択中の反応をもう一度押すと未反応に戻ります。</p>
            {actionError && <p role="alert" className="mt-4 text-sm text-red-700">{actionError}</p>}
            {success && <p role="status" className="mt-4 text-sm text-green-800">{success}</p>}
          </section>
          <Link href={`/app/outings/new?itemId=${encodeURIComponent(item.id)}`} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">この候補からおでかけを作る</Link>
        </>
      )}
    </div>
  );
}

export default function ItemDetailPage() {
  return <Suspense fallback={<p role="status">候補を読み込んでいます…</p>}><ItemDetailContent /></Suspense>;
}
