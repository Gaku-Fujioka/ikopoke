import Link from "next/link";
import {ArrowRight,Camera,MapPin} from "lucide-react";
import {PrivatePhotoPreview} from "@/components/visits/private-visit-image";
import {prettyDate} from "@/lib/home/navigation";
import {groupColorStyle} from "@/lib/presentation/colors";
import type {VisitSummary} from "@/lib/visits/repository";
import {visitTimeLabel} from "@/lib/visits/time";
import type {CSSProperties} from "react";

export function VisitTimeline({visits,groups=[],photosUnavailable=false}:{visits:VisitSummary[];groups?:{id:string;name:string;presentation?:{color?:string|null}|null}[];photosUnavailable?:boolean}){
  const dates=[...new Set(visits.map(visit=>visit.visited_on))];
  return <div className="space-y-7">
    {photosUnavailable&&<p role="status" className="text-sm text-stone-600">写真の一覧を読み込めませんでした。訪問記録は開けます。再読み込みしてお試しください。</p>}
    {dates.map(date=><section key={date} className="kk-visit-day" aria-label={prettyDate(date)}>
      <h2 className="mb-3 flex items-center gap-3 text-base font-bold"><span className="h-2.5 w-2.5 rounded-full bg-orange-700" aria-hidden="true"/><time dateTime={date}>{prettyDate(date)}</time></h2>
      <ul className="space-y-3 border-l-2 border-stone-200 pl-4">{visits.filter(visit=>visit.visited_on===date).map(visit=>{
        const group=groups.find(group=>group.id===visit.group_id);
        return <li key={visit.id}><Link href={`/app/groups/${visit.group_id}/visits/${visit.id}`} className="kk-visit-entry" style={groupColorStyle(group?.presentation?.color) as CSSProperties}>
          <div className="kk-visit-thumbnail" aria-hidden="true">{visit.preview?<PrivatePhotoPreview path={visit.preview.object_path} contentType={visit.preview.content_type} alt=""/>:<MapPin size={28}/>}</div>
          <div className="min-w-0 flex-1 space-y-2">
            {group&&<p className="kk-visit-group">{group.name}</p>}
            <h3 className="break-words text-lg font-bold leading-snug">{visit.item_title}</h3>
            {(visit.visited_time||visit.visited_period)&&<p className="text-xs text-stone-600">{visitTimeLabel(visit)}</p>}
            <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-stone-600">{visit.note||"どんな一日だった？ひとことを残そう。"}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="inline-flex items-center gap-1 text-stone-600">{visit.photoCount!==null&&<><Camera size={14} aria-hidden="true"/>写真 {visit.photoCount}枚</>}</span><span className="inline-flex min-h-6 items-center gap-1 font-semibold text-orange-700">記録をひらく<ArrowRight size={14} aria-hidden="true"/></span></div>
          </div>
        </Link></li>;
      })}</ul>
    </section>)}
  </div>;
}
