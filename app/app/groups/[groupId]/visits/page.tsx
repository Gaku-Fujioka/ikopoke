import {Suspense} from "react";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {hasEnvVars} from "@/lib/utils";
import {isGroupId} from "@/lib/groups/validation";
import {getGroup} from "@/lib/groups/repository";
import {itemPage} from "@/lib/items/validation";
import {listVisits} from "@/lib/visits/repository";
import {AuthSetupNotice} from "@/components/auth-setup-notice";
type Props={params:Promise<{groupId:string}>;searchParams:Promise<{item?:string|string[];outing?:string|string[];page?:string|string[]}>};
async function Content({params,searchParams}:Props){
  const {groupId}=await params;if(!isGroupId(groupId))notFound();if(!hasEnvVars)return <AuthSetupNotice/>;
  const search=await searchParams,page=itemPage(search.page),itemId=isGroupId(search.item)?search.item:undefined,outingId=isGroupId(search.outing)?search.outing:undefined;
  const href=(number:number)=>{const q=new URLSearchParams();if(itemId)q.set("item",itemId);if(outingId)q.set("outing",outingId);if(number>1)q.set("page",String(number));return `/app/groups/${groupId}/visits${q.size?`?${q}`:""}`;};
  const client=await createClient(),{data,error}=await client.auth.getClaims();if(error||!data?.claims?.sub)redirect(`/auth/login?next=${encodeURIComponent(href(page))}`);
  let group,saved;try{[group,saved]=await Promise.all([getGroup(client,groupId),listVisits(client,groupId,page,{itemId,outingId})]);}catch{return <p role="alert">訪問記録を読み込めませんでした。もう一度お試しください。</p>;}
  if(!group)notFound();
  return <div className="space-y-6"><Link href={`/app/groups/${groupId}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">← グループへ</Link><div><p className="text-sm font-semibold text-orange-700">{group.name}</p><h1 className="mt-2 text-3xl font-bold">みんなの訪問記録</h1><p className="mt-3 text-stone-600">訪問日が新しい順に表示します。再訪も別の記録として残ります。</p></div>
    <div className="flex flex-wrap gap-4"><Link href={`/app/groups/${groupId}/items`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">候補から訪問を記録する</Link>{(itemId||outingId)&&<Link href={`/app/groups/${groupId}/visits`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">すべての記録を見る</Link>}</div>
    <p className="text-sm text-stone-600">{itemId||outingId?"選択した候補・計画の記録：":"全"}{saved.total}件</p>
    {saved.visits.length?<ul className="grid gap-4 sm:grid-cols-2">{saved.visits.map(visit=><li key={visit.id}><Link href={`/app/groups/${groupId}/visits/${visit.id}`} className="block h-full rounded-3xl border border-stone-200 bg-white p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"><time dateTime={visit.visited_on} className="text-sm font-semibold text-orange-700">{visit.visited_on}</time><h2 className="mt-2 break-words text-xl font-bold">{visit.item_title}</h2><p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm text-stone-600">{visit.note||"メモはまだありません。"}</p></Link></li>)}</ul>:<p className="rounded-3xl border bg-white p-6 text-stone-600">{page>1?"このページに記録はありません。":"訪問記録はまだありません。"}</p>}
    <nav aria-label="訪問記録のページ" className="flex flex-wrap gap-5">{page>1&&<Link href={href(page-1)} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">前のページ</Link>}{page*20<saved.total&&<Link href={href(page+1)} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">次のページ</Link>}</nav>
  </div>;
}
export default function VisitsPage(props:Props){return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status">訪問記録を読み込んでいます…</p>}><Content {...props}/></Suspense></div>;}
