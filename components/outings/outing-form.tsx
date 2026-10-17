"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveOutingAction } from "@/app/app/groups/[groupId]/outings/actions";
import { OUTING_MODES, OUTING_PERIODS, type OutingMode, type OutingPeriod } from "@/lib/outings/validation";
import type { CandidateOption, OutingDetail } from "@/lib/outings/repository";
import type { GroupMember } from "@/lib/profiles/repository";

type DraftSlot = { item_id: string; planned_time: string; period: OutingPeriod | "" };

export function OutingForm({ groupId, outingId, current, candidates, members, actorId, initialItemId }: {
  groupId: string; outingId: string; current: OutingDetail | null; candidates: CandidateOption[]; members: GroupMember[]; actorId: string; initialItemId?: string;
}) {
  const [title, setTitle] = useState(current?.outing.title ?? "");
  const [date, setDate] = useState(current?.outing.outing_date ?? "");
  const [memo, setMemo] = useState(current?.outing.memo ?? "");
  const [mode, setMode] = useState<OutingMode>(current?.outing.mode ?? "order");
  const initialSlots: DraftSlot[] = current?.items.map(item => ({ item_id: item.item_id, planned_time: item.planned_time?.slice(0,5) ?? "", period: item.period ?? "" })) ??
    (initialItemId && candidates.some(item => item.id === initialItemId) ? [{ item_id: initialItemId, planned_time: "", period: "" }] : []);
  const [slots, setSlots] = useState<DraftSlot[]>(initialSlots);
  const [participants, setParticipants] = useState<string[]>(current?.participants ?? (members.some(member => member.user_id === actorId && member.display_name) ? [actorId] : []));
  const [toAdd, setToAdd] = useState("");
  const [state, action, pending] = useActionState(saveOutingAction, { error: null });
  const selfHasName = Boolean(members.find(member => member.user_id === actorId)?.display_name);
  const choices = candidates.filter(candidate => !slots.some(slot => slot.item_id === candidate.id));
  const field = "min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700";
  const changeSlot = (index: number, change: Partial<DraftSlot>) => setSlots(currentSlots => currentSlots.map((slot, at) => at === index ? { ...slot, ...change } : slot));
  const moveSlot = (index: number, change: number) => setSlots(currentSlots => { const next = [...currentSlots]; [next[index], next[index + change]] = [next[index + change], next[index]]; return next; });

  return <form action={action} aria-busy={pending} className="space-y-7">
    <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="outingId" value={outingId} /><input type="hidden" name="expectedRevision" value={current?.outing.revision ?? 0} />
    <input type="hidden" name="items" value={JSON.stringify(slots.map(slot => ({ item_id: slot.item_id, planned_time: slot.planned_time || null, period: slot.period || null })))} />
    <input type="hidden" name="participants" value={JSON.stringify(participants)} />
    <section className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <div className="space-y-2"><label htmlFor="outing-title" className="block font-semibold">計画の名前（必須）</label><input id="outing-title" name="title" required value={title} onChange={event => setTitle(event.target.value)} className={field} placeholder="例：週末のおでかけ" /><p className="text-xs text-stone-500">120文字以内</p></div>
      <div className="space-y-2"><label htmlFor="outing-date" className="block font-semibold">日付（必須）</label><input id="outing-date" name="date" type="date" required value={date} onChange={event => setDate(event.target.value)} className={field} /></div>
      <div className="space-y-2"><label htmlFor="outing-mode" className="block font-semibold">計画モード</label><select id="outing-mode" name="mode" value={mode} onChange={event => setMode(event.target.value as OutingMode)} className={field}>{OUTING_MODES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><p className="text-sm text-stone-600">モードを変えても、入力済みの時刻・時間帯と候補の順番は保持します。</p></div>
      <div className="space-y-2"><label htmlFor="outing-memo" className="block font-semibold">メモ</label><textarea id="outing-memo" name="memo" rows={3} value={memo} onChange={event => setMemo(event.target.value)} className={`${field} py-3`} /><p className="text-xs text-stone-500">2,000文字以内</p></div>
    </section>
    <section aria-labelledby="outing-items-heading" className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <div><h2 id="outing-items-heading" className="text-xl font-bold">行く候補（{slots.length}件）</h2><p className="mt-2 text-sm text-stone-600">1〜50件。順番を入れ替えられます。計画から外しても元の候補は残ります。</p></div>
      {slots.length > 0 && <ol className="space-y-3">{slots.map((slot,index) => {
        const candidate = candidates.find(item => item.id === slot.item_id);
        return <li key={slot.item_id} className="space-y-3 rounded-2xl border border-stone-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="break-words font-semibold">{index+1}. {candidate?.title ?? "候補を取得できませんでした"}</span><div className="flex flex-wrap gap-2"><button type="button" disabled={index === 0 || pending} onClick={() => moveSlot(index,-1)} aria-label={`${candidate?.title ?? "候補"}を前へ`} className="min-h-11 rounded-full border px-3 disabled:opacity-40">↑</button><button type="button" disabled={index === slots.length-1 || pending} onClick={() => moveSlot(index,1)} aria-label={`${candidate?.title ?? "候補"}を後へ`} className="min-h-11 rounded-full border px-3 disabled:opacity-40">↓</button><button type="button" disabled={pending} onClick={() => setSlots(currentSlots => currentSlots.filter((_,at) => at !== index))} className="min-h-11 px-2 font-semibold text-red-700 underline">外す</button></div></div>
          {mode === "exact" && <label className="block text-sm font-semibold">時刻<input type="time" required value={slot.planned_time} onChange={event => changeSlot(index,{planned_time:event.target.value})} className={`${field} mt-2`} /></label>}
          {mode === "period" && <label className="block text-sm font-semibold">時間帯<select required value={slot.period} onChange={event => changeSlot(index,{period:event.target.value as OutingPeriod | ""})} className={`${field} mt-2`}><option value="">選択してください</option>{OUTING_PERIODS.map(period => <option key={period.value} value={period.value}>{period.label}</option>)}</select></label>}
        </li>;
      })}</ol>}
      <div className="flex flex-wrap items-end gap-3"><label htmlFor="outing-add-item" className="min-w-0 flex-1 basis-48 space-y-2 text-sm font-semibold"><span className="block">候補を追加</span><select id="outing-add-item" value={toAdd} onChange={event => setToAdd(event.target.value)} disabled={!choices.length || pending} className={field}><option value="">{choices.length ? "候補を選ぶ" : "追加できる候補がありません"}</option>{choices.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><button type="button" disabled={!toAdd || slots.length >= 50 || pending} onClick={() => { setSlots(currentSlots => [...currentSlots,{item_id:toAdd,planned_time:"",period:""}]);setToAdd(""); }} className="min-h-12 rounded-full border border-orange-700 px-5 font-semibold text-orange-700 disabled:opacity-40">追加</button></div>
      <Link href={`/app/groups/${groupId}/items`} className="inline-flex min-h-11 items-center text-sm font-semibold text-orange-700 underline">候補を探す・追加する</Link>
    </section>
    <section aria-labelledby="outing-participants-heading" className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8"><h2 id="outing-participants-heading" className="text-xl font-bold">参加者（{participants.length}人）</h2><p className="text-sm text-stone-600">所属メンバーから1人以上選んでください。</p>
      {!selfHasName && <p role="status" className="text-sm text-red-700">先に<Link href="/app/profile" className="font-semibold underline">自分の表示名を設定</Link>してください。</p>}
      <div className="grid gap-2 sm:grid-cols-2">{members.map(member => <label key={member.user_id} className="flex min-h-12 items-center gap-3 rounded-xl border border-stone-200 p-3"><input type="checkbox" checked={participants.includes(member.user_id)} disabled={pending || !member.display_name} onChange={event => setParticipants(current => event.target.checked ? [...current,member.user_id] : current.filter(id => id !== member.user_id))} className="size-5 accent-orange-700" /><span className="break-words">{member.display_name ?? "表示名未設定（本人の設定待ち）"}{member.user_id === actorId ? "（自分）" : ""}</span></label>)}</div>
    </section>
    {state.error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{state.error}</p>}
    <button type="submit" disabled={pending || !selfHasName || !slots.length || !participants.length} className="min-h-12 w-full rounded-full bg-orange-700 px-6 font-semibold text-white disabled:opacity-40 sm:w-auto">{pending ? "保存中…" : current ? "計画を保存" : "計画を作成"}</button>
  </form>;
}
