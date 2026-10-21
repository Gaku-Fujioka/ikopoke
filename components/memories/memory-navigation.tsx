import Link from "next/link";
import {BookOpen,MapPin,Plus} from "lucide-react";
import {addHref} from "@/lib/home/navigation";

export function MemoryNavigation({groupId,active}:{groupId?:string;active:"albums"|"visits"}){
  const base=groupId?`/app/groups/${groupId}`:"/app";
  return <div className="space-y-4">
    <nav aria-label="思い出の表示" className="kk-memory-navigation">
      <Link href={`${base}/memories`} aria-current={active==="albums"?"page":undefined}><BookOpen size={22} aria-hidden="true"/><span><strong>アルバム</strong><small>みんなで残す、一冊の本</small></span></Link>
      <Link href={groupId?`${base}/visits`:"/app/memories?view=visits"} aria-current={active==="visits"?"page":undefined}><MapPin size={22} aria-hidden="true"/><span><strong>訪問記録</strong><small>写真とひとことで振り返る</small></span></Link>
    </nav>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-stone-600">日々の「行った！」も、ここに。</p><Link href={addHref("visit",groupId)} className="kk-primary-link"><Plus size={18} aria-hidden="true"/>訪問を記録</Link></div>
  </div>;
}
