import Link from "next/link";
import { Ellipsis, Plus, UsersRound } from "lucide-react";
import type { SavedGroup } from "@/lib/groups/repository";
import { groupTone } from "@/lib/home/navigation";

export function GroupCards({ groups, selected }: { groups: SavedGroup[]; selected: string | null }) {
  const current = groups.find(group => group.id === selected);
  return <section aria-label="マイグループ" className="kk-groups-section" data-home-section="groups">
    <div className="kk-row"><h2 className="kk-section-label">一緒に、たのしむ人たち</h2><Link href="/app" className="kk-text-link" aria-current={!selected ? "page" : undefined}>すべて</Link></div>
    <div className="kk-group-strip">
      {groups.map(group => <Link key={group.id} href={`/app/groups/${group.id}`} className="kk-group-card" data-tone={groupTone(group.id)} aria-current={selected === group.id ? "page" : undefined}><UsersRound aria-hidden="true" size={21} /><span>{group.name}</span><small>{selected === group.id ? "いま開いています" : "一緒に見つける →"}</small></Link>)}
      <Link href="/app/groups#new-group" className="kk-group-card kk-new-group"><Plus aria-hidden="true" size={22} /><span>グループを作る</span><small>新しい楽しみを</small></Link>
    </div>
    {current && <div className="kk-group-context"><span><strong>{current.name}</strong>のホーム</span><Link href={`/app/groups/${current.id}/settings`} className="kk-icon-button" aria-label={`${current.name}の設定・メンバー・招待`}><Ellipsis aria-hidden="true" /></Link></div>}
  </section>;
}
