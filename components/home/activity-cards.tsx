import Link from "next/link";
import { BookmarkPlus, CalendarDays, Footprints, Heart, Images, MessageCircle, Minus } from "lucide-react";
import type { Activity } from "@/lib/home/repository";
import type { SavedGroup } from "@/lib/groups/repository";
import { groupTone } from "@/lib/home/navigation";

const actions = {
  item: { label: "見つけた！", icon: BookmarkPlus, path: "items" },
  want_to_go: { label: "行きたい！", icon: Heart, path: "items" },
  not_now: { label: "そこまで", icon: Minus, path: "items" },
  comment: { label: "おしゃべり", icon: MessageCircle, path: "items" },
  outing: { label: "計画したよ", icon: CalendarDays, path: "outings" },
  visit: { label: "行ってきた！", icon: Footprints, path: "visits" },
  memory: { label: "一冊できた！", icon: Images, path: "memories" },
} as const;
export function ActivityCards({ entries, groups, expanded = false }: { entries: Activity[]; groups: SavedGroup[]; expanded?: boolean }) {
  return <ul className={expanded ? "kk-activity-list" : `kk-collage${entries.length > 4 ? " kk-collage-busy" : ""}`}>
    {entries.map(entry => {
      const action = actions[entry.kind], Icon = action.icon;
      const actor = entry.kind === "memory" ? "みんなの思い出" : entry.is_mine ? "あなた" : entry.actor_name || "メンバー";
      const group = groups.find(value => value.id === entry.group_id)?.name ?? "グループ";
      const when = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(entry.occurred_at));
      return <li key={entry.event_key}><Link href={`/app/groups/${entry.group_id}/${action.path}/${entry.subject_id}`} className="kk-activity-card" data-tone={groupTone(entry.group_id)} aria-label={`${actor} · ${entry.title} · ${action.label} · ${group} · ${when} 日本時間`}>
        <span className="kk-activity-person"><span className="kk-avatar" aria-hidden="true">{Array.from(actor)[0]}</span><span>{actor}</span></span>
        <strong className="kk-activity-title">{entry.title}</strong><span className="kk-activity-action"><Icon aria-hidden="true" size={15} />{action.label}</span>
        <span className="kk-activity-meta"><span>{group}</span><time dateTime={entry.occurred_at}>{when}</time></span>
      </Link></li>;
    })}
  </ul>;
}
