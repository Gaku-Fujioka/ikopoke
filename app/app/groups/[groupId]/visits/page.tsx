import {Suspense} from "react";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {hasEnvVars} from "@/lib/utils";
import {isGroupId} from "@/lib/groups/validation";
import {getGroup} from "@/lib/groups/repository";
import {itemPage} from "@/lib/items/validation";
import {listVisitSummaries} from "@/lib/visits/repository";
import {VisitTimeline} from "@/components/visits/visit-timeline";
import {MemoryNavigation} from "@/components/memories/memory-navigation";
import {AuthSetupNotice} from "@/components/auth-setup-notice";
type Props={params:Promise<{groupId:string}>;searchParams:Promise<{item?:string|string[];outing?:string|string[];page?:string|string[]}>};
async function Content({params,searchParams}:Props){
  const {groupId}=await params;if(!isGroupId(groupId))notFound();if(!hasEnvVars)return <AuthSetupNotice/>;
  const search=await searchParams,page=itemPage(search.page),itemId=isGroupId(search.item)?search.item:undefined,outingId=isGroupId(search.outing)?search.outing:undefined;
  const href=(number:number)=>{const q=new URLSearchParams();if(itemId)q.set("item",itemId);if(outingId)q.set("outing",outingId);if(number>1)q.set("page",String(number));return `/app/groups/${groupId}/visits${q.size?`?${q}`:""}`;};
  const client=await createClient(),{data,error}=await client.auth.getClaims();if(error||!data?.claims?.sub)redirect(`/auth/login?next=${encodeURIComponent(href(page))}`);
  let group,saved;try{[group,saved]=await Promise.all([getGroup(client,groupId),listVisitSummaries(client,groupId,page,{itemId,outingId})]);}catch{return <p role="alert">訪問記録を読み込めませんでした。もう一度お試しください。</p>;}
  if(!group)notFound();
  return <div className="space-y-6"><Link href={`/app/groups/${groupId}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">← グループへ</Link><div><p className="text-sm font-semibold text-orange-700">{group.name}</p><h1 className="mt-2 text-3xl font-bold">みんなの訪問記録</h1><p className="mt-3 text-stone-600">訪問日が新しい順に表示します。再訪も別の記録として残ります。</p></div>
    <MemoryNavigation groupId={groupId} active="visits"/>
    {(itemId||outingId)&&<Link href={`/app/groups/${groupId}/visits`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">絞り込みを解除して、すべての記録を見る</Link>}
    <p className="text-sm text-stone-600">{itemId||outingId?"選択した候補・計画の記録：":"全"}{saved.total}件</p>
    {saved.visits.length?<VisitTimeline visits={saved.visits} photosUnavailable={saved.photosUnavailable}/>:<p className="rounded-3xl border bg-white p-6 leading-7 text-stone-600">{page>1?"このページに記録はありません。":"訪問記録はまだありません。「訪問を記録」から、写真やひとことと一緒に残してみよう。"}</p>}
    <nav aria-label="訪問記録のページ" className="flex flex-wrap gap-5">{page>1&&<Link href={href(page-1)} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">前のページ</Link>}{page*20<saved.total&&<Link href={href(page+1)} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">次のページ</Link>}</nav>
  </div>;
}
export default function VisitsPage(props:Props){return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status">訪問記録を読み込んでいます…</p>}><Content {...props}/></Suspense></div>;}
