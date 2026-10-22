"use client";

import { useRef } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, CalendarDays, House, Images, LoaderCircle, MapPin, Plus, X, type LucideIcon } from "lucide-react";
import { addHref, pathGroup } from "@/lib/home/navigation";
import { isGroupId } from "@/lib/groups/validation";

function TabContents({ label, icon: Icon, active }: { label: string; icon: LucideIcon; active: boolean }) {
  const { pending } = useLinkStatus();
  return <>
    <span className="kk-tab-glyph" data-pending={pending}>
      <Icon aria-hidden="true" size={21} strokeWidth={active ? 2.5 : 1.8} className={pending ? "opacity-0" : undefined} />
      {pending && <LoaderCircle aria-hidden="true" size={21} className="absolute inset-0 motion-safe:animate-spin" />}
    </span>
    <span>{label}</span>
    {pending && <span role="status" className="sr-only">{label}へ移動しています…</span>}
  </>;
}

export function AppNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const selected = pathname === "/app/new" ? search.get("group") : null;
  const groupId = pathGroup(pathname) ?? (isGroupId(selected) ? selected : null);
  const base = groupId ? `/app/groups/${groupId}` : "/app";
  const dialog = useRef<HTMLDialogElement>(null);
  const tabs = [
    { href: base, label: "ホーム", icon: House, active: pathname === base || (groupId && pathname.startsWith(`${base}/settings`)) },
    { href: `${base}/items`, label: "行きたい", icon: Bookmark, active: pathname.startsWith(`${base}/items`) || pathname.startsWith(`${base}/lists`) },
    { href: `${base}/outings`, label: "おでかけ", icon: CalendarDays, active: pathname.startsWith(`${base}/outings`) },
    { href: `${base}/memories`, label: "思い出", icon: Images, active: pathname.startsWith(`${base}/memories`) || pathname.startsWith(`${base}/visits`) },
  ];
  const tab = (index: number) => {
    const { href, label, icon: Icon, active } = tabs[index];
    // Keep the main destinations ready, without prefetching protected pages during an invitation.
    return <Link key={href} href={href} prefetch={pathname !== "/app/groups/join" && pathname !== href} aria-current={active ? "page" : undefined} className="kk-tab"><TabContents label={label} icon={Icon} active={Boolean(active)} /></Link>;
  };
  return <>
    <nav aria-label="アプリのメインナビゲーション" className="kk-nav"><div className="kk-nav-inner">
      {tab(0)}{tab(1)}
      <button type="button" className="kk-add" aria-label="候補・おでかけ計画・訪問記録を追加" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><span><Plus aria-hidden="true" size={25} /></span>追加</button>
      {tab(2)}{tab(3)}
    </div></nav>
    <dialog ref={dialog} className="kk-add-dialog" aria-labelledby="quick-add-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="kk-sheet-content">
        <div className="kk-row"><div><p className="kk-eyebrow">小さなきっかけから</p><h2 id="quick-add-title">何を残そう？</h2></div><button type="button" className="kk-icon-button" aria-label="追加メニューを閉じる" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></button></div>
        <p className="kk-muted">{groupId ? "いま開いているグループに追加します。" : "次の画面で共有するグループを選びます。"}</p>
        {([
          ["item", Bookmark, "行きたい候補", "気になる場所や、やってみたいこと"],
          ["outing", CalendarDays, "おでかけ計画", "行きたいを、次の楽しみに"],
          ["visit", MapPin, "訪問記録", "行ってきた日の写真や気持ち"],
        ] as const).map(([kind, Icon, title, description]) => <Link key={kind} className="kk-add-option" href={addHref(kind, groupId)} onClick={() => dialog.current?.close()}><span className="kk-option-icon"><Icon aria-hidden="true" /></span><span><strong>{title}</strong><small>{description}</small></span><span aria-hidden="true">→</span></Link>)}
      </div>
    </dialog>
  </>;
}
