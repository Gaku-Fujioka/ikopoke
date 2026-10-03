"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { ItemKind } from "@/lib/kokoiko/contracts";
import { createMockRepository, MOCK_GROUP_ID } from "@/lib/kokoiko/mock-repository";
import { messageFromError } from "@/components/flow/use-mock-snapshot";

export default function NewItemPage() {
  const router = useRouter();
  const submitting = useRef(false);
  const [kind, setKind] = useState<ItemKind>("spot");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!title.trim()) {
      setError("名前を入力してください。");
      return;
    }

    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const item = createMockRepository(window.localStorage).createItem(MOCK_GROUP_ID, { kind, title, note });
      router.push(`/app/items/${encodeURIComponent(item.id)}`);
    } catch (cause) {
      setError(messageFromError(cause));
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <Link href="/app/items" className="text-sm font-semibold text-stone-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">← 行きたい一覧へ</Link>
      <div>
        <p className="text-sm font-semibold tracking-widest text-orange-700">候補を追加</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">気になることを残そう</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">このブラウザ内だけのデモ保存です。名前だけでも追加できます。</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">種類</legend>
          <div className="flex flex-wrap gap-3">
            {(["spot", "activity"] as const).map((value) => (
              <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-stone-300 px-4 text-sm focus-within:ring-2 focus-within:ring-orange-700">
                <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                {value === "spot" ? "場所" : "やりたいこと"}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2">
          <label htmlFor="item-title" className="block text-sm font-semibold">名前 <span className="text-orange-700">必須</span></label>
          <input id="item-title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(error && !title.trim())} aria-describedby={error && !title.trim() ? "item-error" : undefined} className="min-h-12 w-full rounded-xl border border-stone-300 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700" placeholder="例：気になるカフェ" />
        </div>
        <div className="space-y-2">
          <label htmlFor="item-note" className="block text-sm font-semibold">メモ <span className="font-normal text-stone-500">任意</span></label>
          <textarea id="item-note" name="note" value={note} onChange={(event) => setNote(event.target.value)} rows={4} className="w-full rounded-xl border border-stone-300 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700" placeholder="行ってみたい理由など" />
        </div>
        {error && <p id="item-error" role="alert" className="text-sm font-medium text-red-700">{error}</p>}
        <button type="submit" disabled={saving} className="min-h-12 w-full rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{saving ? "保存中…" : "このブラウザに保存"}</button>
      </form>
    </div>
  );
}
