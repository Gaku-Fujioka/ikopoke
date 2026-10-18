"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarPlus, Check, Coffee, Sparkles } from "lucide-react";
import type { SavedItem } from "@/lib/items/repository";
import { planSelection, parseSelection, SELECTION_EVENT, EMPTY_SELECTION } from "@/lib/items/plan-selection";
import { QuickReaction } from "./quick-reaction";

function subscribeSelection(listener: () => void) {
  const events = [SELECTION_EVENT, "pageshow", "popstate", "focus"];
  events.forEach(event => window.addEventListener(event, listener));
  return () => events.forEach(event => window.removeEventListener(event, listener));
}
export function PlanSelectionReceipt({ groupId, ids }: { groupId: string; ids: string[] }) {
  const router = useRouter(), pathname = usePathname();
  useEffect(() => {
    planSelection.clear(groupId);
    // Consume the receipt so revisiting the plan cannot clear a future selection.
    router.replace(pathname, { scroll: false });
  }, [groupId, ids, pathname, router]);
  return <p role="status" className="kk-selection-summary">選んだ候補を計画に保存しました。</p>;
}
export function CandidateBoard({ groupId, items, links }: { groupId: string; items: SavedItem[]; links: Record<string, string> }) {
  const snapshot = useSyncExternalStore(subscribeSelection, () => planSelection.snapshot(groupId), () => EMPTY_SELECTION);
  const selected = useMemo(() => parseSelection(snapshot), [snapshot]);
  const setSelected = (change: Parameters<typeof planSelection.update>[1]) => planSelection.update(groupId, change);
  const query = new URLSearchParams({ items: selected.map(c => c.id).join(",") });
  function toggle(item: SavedItem) { setSelected(before => before.some(c => c.id === item.id) ? before.filter(c => c.id !== item.id) : before.length < 50 ? [...before, { id: item.id, title: item.title }] : before); }
  return <div className="space-y-4">
    <p className="kk-muted">気持ちはその場で。行き先を選んだら、まとめて計画へ。<br /><small>選んだ候補は、このタブでページや検索条件を変えても残ります。</small></p>
    <ul className="kk-board-grid">{items.map(item => { const checked = selected.some(c => c.id === item.id), Icon = item.kind === "spot" ? Coffee : Sparkles; return <li key={item.id} className="kk-choice-card" data-selected={checked}>
      <div className="kk-choice-top"><span className="kk-kind"><Icon size={17} aria-hidden="true" />{item.kind === "spot" ? "スポット" : "やりたいこと"}</span>{item.visited && <span className="kk-label">行ったことある</span>}</div>
      <Link href={links[item.id]} className="kk-choice-title"><h2>{item.title}</h2><p>{item.memo || "みんなは、どう思う？"}</p></Link>
      <div className="kk-choice-meta">{item.priority ? <span>優先度：{["", "低", "中", "高"][item.priority]}</span> : <span>まだ決まっていない楽しみ</span>}{item.score !== undefined && <span>おすすめ {item.score}点</span>}</div>
      <QuickReaction groupId={groupId} itemId={item.id} title={item.title} value={item.my_reaction ?? null} count={item.want_count ?? 0} />
      {!item.archived_at ? <label className="kk-choice-select"><input type="checkbox" checked={checked} disabled={!checked && selected.length >= 50} onChange={() => toggle(item)} /><span>{checked ? <><Check size={16} aria-hidden="true" />計画に使う候補に選択中</> : <><CalendarPlus size={16} aria-hidden="true" />計画に使う</>}</span></label> : <p className="kk-muted px-4 pb-4">アーカイブ中</p>}
    </li>; })}</ul>
    {selected.length > 0 && <aside aria-label="選んだ候補から計画" className="kk-selection-tray">
      <div className="kk-row"><strong>{selected.length}件を選択中</strong><button onClick={() => setSelected(() => [])} className="kk-text-link">選択を解除</button></div>
      <details><summary className="min-h-11 cursor-pointer py-2 text-sm">選んだ候補を確認・外す</summary><ul>{selected.map(c => <li key={c.id} className="flex items-center justify-between gap-3 py-1 text-sm"><span className="min-w-0 break-words">{c.title}</span><button className="min-h-11 shrink-0 px-3 underline" aria-label={`${c.title}を選択から外す`} onClick={() => setSelected(before => before.filter(s => s.id !== c.id))}>外す</button></li>)}</ul></details>
      <div className="kk-selection-actions"><Link href={`/app/groups/${groupId}/outings/new?${query}`} className="kk-primary-link">新しい計画にする →</Link><Link href={`/app/groups/${groupId}/outings/add?${query}`} className="kk-secondary-link">既存の計画へ追加</Link></div>
    </aside>}
  </div>;
}
