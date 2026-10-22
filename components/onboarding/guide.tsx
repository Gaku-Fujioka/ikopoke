"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, MapPin, UsersRound } from "lucide-react";
import { PocketMark } from "@/components/brand/pocket-mark";
import { acknowledgeGuideAction } from "@/app/app/guide/actions";
import { deferGuide, guideSteps } from "@/lib/onboarding/guide";

const icons = { group: UsersRound, place: MapPin, calendar: CalendarDays, camera: Camera, book: BookOpen };
const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--kk-brand)] px-6 py-3 font-bold text-stone-950 hover:bg-[var(--kk-brand-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 disabled:opacity-60";

export function GuideContent({ onClose, dismissButton }: { onClose?: () => void; dismissButton?: RefObject<HTMLButtonElement | null> }) {
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const current = guideSteps[step];
  const Icon = current.icon === "pocket" ? null : icons[current.icon];
  const last = step === guideSteps.length - 1;

  useEffect(() => { title.current?.focus(); }, [step]);

  function close() {
    if (onClose) onClose();
    else router.replace("/app");
  }

  async function finish() {
    // Replaying the guide is read-only; it must work even if saving is offline.
    if (!onClose) { router.replace("/app"); return; }
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await acknowledgeGuideAction();
      if (result.error) { setError(result.error); return; }
      close();
      router.refresh();
    } catch {
      setError("保存できませんでした。再試行するか、今回は閉じてアプリを使えます。");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return <div aria-busy={pending} className="text-stone-950">
    <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-3 sm:px-7">
      <span className="flex items-center gap-2 text-sm font-bold"><PocketMark className="h-7 w-7" />いこポケの使い方</span>
      {onClose ? <button ref={dismissButton} type="button" disabled={pending} onClick={() => void finish()} className="min-h-11 shrink-0 px-2 text-sm text-stone-600 underline underline-offset-4 disabled:opacity-60">あとで見る</button>
        : <Link href="/app/profile" className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm text-stone-600 underline underline-offset-4">閉じる</Link>}
    </div>
    <div className="space-y-5 px-5 py-6 sm:px-7">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-bold tracking-wide text-orange-800">{current.label}</p>
        <p className="shrink-0 text-sm text-stone-600" aria-label={`ステップ${step + 1}、全${guideSteps.length}ステップ`}>{step + 1} / {guideSteps.length}</p>
      </div>
      <div className="flex h-24 items-center justify-center rounded-3xl border-2 border-stone-900 bg-orange-50 shadow-[3px_3px_0_#1c1917]" aria-hidden="true">
        {Icon ? <Icon size={48} strokeWidth={1.7} /> : <PocketMark className="h-20 w-20" />}
      </div>
      <div className="space-y-3">
        <h2 id="guide-title" ref={title} data-guide-title tabIndex={-1} className="text-2xl font-bold leading-snug outline-none">{current.title}</h2>
        <p className="text-sm leading-7 text-stone-700">{current.description}</p>
      </div>
      <ul className="space-y-3">{current.tips.map(tip => <li key={tip} className="flex gap-2 text-sm leading-7"><Check size={18} aria-hidden="true" className="mt-1 shrink-0 text-orange-800" /><span>{tip}</span></li>)}</ul>
      <p className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-stone-700">{current.hint}</p>
      {error && <div className="space-y-2"><p role="alert" className="text-sm leading-6 text-red-700">{error}</p><button type="button" disabled={pending} onClick={close} className="min-h-11 text-sm underline underline-offset-4">今回は閉じる</button></div>}
    </div>
    <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-stone-200 bg-white px-5 py-4 sm:px-7">
      <button type="button" disabled={step === 0 || pending} onClick={() => setStep(index => Math.max(0, index - 1))} className="inline-flex min-h-12 items-center gap-1 rounded-full px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 disabled:opacity-40"><ChevronLeft size={18} aria-hidden="true" />戻る</button>
      {last ? <button type="button" disabled={pending} onClick={() => void finish()} className={primary}>{pending ? "保存中…" : onClose ? "使いはじめる" : "ホームへ"}<Check size={18} aria-hidden="true" /></button>
        : <button type="button" disabled={pending} onClick={() => setStep(index => Math.min(guideSteps.length - 1, index + 1))} className={primary}>次へ<ChevronRight size={18} aria-hidden="true" /></button>}
    </div>
  </div>;
}

export function GuideDialog() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dismissButton = useRef<HTMLButtonElement>(null);
  const active = !dismissed && !deferGuide(pathname);
  useEffect(() => {
    const element = dialog.current;
    if (!active || !element) return;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    element.querySelector<HTMLElement>("[data-guide-title]")?.focus();
    return () => { element.close(); document.body.style.overflow = previousOverflow; };
  }, [active]);
  if (!active) return null;
  return <dialog ref={dialog} aria-labelledby="guide-title" onCancel={event => { event.preventDefault(); dismissButton.current?.click(); }} className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-[1.75rem] border-2 border-stone-900 bg-white p-0 text-stone-950 shadow-xl backdrop:bg-black/35">
    <GuideContent dismissButton={dismissButton} onClose={() => { dialog.current?.close(); setDismissed(true); document.getElementById("main-content")?.focus(); }} />
  </dialog>;
}
