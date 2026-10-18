import Link from "next/link";
import { CalendarDays, Coffee, Images, Sparkles } from "lucide-react";
import { groupTone, prettyDate } from "@/lib/home/navigation";

export function CandidateCard({ item, groupName, href }: { item: { id: string; group_id: string; title: string; kind: "spot" | "activity"; memo: string }; groupName: string; href?: string }) {
  const Icon = item.kind === "spot" ? Coffee : Sparkles;
  return <Link href={href ?? `/app/groups/${item.group_id}/items/${item.id}`} className="kk-candidate-card" data-tone={groupTone(item.group_id)}><div className="kk-candidate-art"><Icon aria-hidden="true" /><span aria-hidden="true">✦</span></div><div className="kk-card-body"><span className="kk-card-group">{groupName}</span><h2>{item.title}</h2><p>{item.memo || "どんなふうに楽しもう？"}</p><small>{item.kind === "spot" ? "スポット" : "やりたいこと"} · 見てみる →</small></div></Link>;
}
export function OutingCard({ outing, groupName }: { outing: { id: string; group_id: string; title: string; outing_date: string; completed_at: string | null }; groupName: string }) {
  return <Link href={`/app/groups/${outing.group_id}/outings/${outing.id}`} className="kk-candidate-card" data-tone={groupTone(outing.group_id)}><div className="kk-candidate-art"><CalendarDays aria-hidden="true" /><span aria-hidden="true">✦</span></div><div className="kk-card-body"><span className="kk-card-group">{groupName}</span><h2>{outing.title}</h2><p><time dateTime={outing.outing_date}>{prettyDate(outing.outing_date)}</time></p><small>{outing.completed_at ? "終了済み" : "計画中"} · 計画を開く →</small></div></Link>;
}
export function MemoryCard({ memory, groupName }: { memory: { id: string; group_id: string; title: string; memory_date: string }; groupName: string }) {
  return <Link href={`/app/groups/${memory.group_id}/memories/${memory.id}`} className="kk-candidate-card kk-album-card" data-tone={groupTone(memory.group_id)}><div className="kk-card-body"><Images aria-hidden="true" size={27} /><span className="kk-card-group">{groupName}</span><h2>{memory.title}</h2><p><time dateTime={memory.memory_date}>{prettyDate(memory.memory_date)}</time></p><small>この一冊を開く →</small></div></Link>;
}
