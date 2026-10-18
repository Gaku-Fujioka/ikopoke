import {Suspense} from "react";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {hasEnvVars} from "@/lib/utils";
import {isGroupId} from "@/lib/groups/validation";
import {getGroup} from "@/lib/groups/repository";
import {listMemories} from "@/lib/memories/repository";
import {AuthSetupNotice} from "@/components/auth-setup-notice";
async function Content({params,searchParams}:{params:Promise<{groupId:string}>;searchParams:Promise<{page?:string}>}){
  const {groupId}=await params;if(!isGroupId(groupId))notFound();
  const query=await searchParams,rawPage=query.page??"1",page=/^[1-9]\d{0,5}$/.test(rawPage)?Number(rawPage):1;
  if(!hasEnvVars)return <AuthSetupNotice/>;
  const client=await createClient(),{data,error}=await client.auth.getClaims();
  if(error||!data?.claims?.sub)redirect(`/auth/login?next=${encodeURIComponent(`/app/groups/${groupId}/memories?page=${page}`)}`);
  let group,result;try{[group,result]=await Promise.all([getGroup(client,groupId),listMemories(client,groupId,page)]);}catch{return <p role="alert">思い出を読み込めませんでした。もう一度お試しください。</p>;}
  if(!group)notFound();const base=`/app/groups/${groupId}`;
  return <div className="space-y-6"><Link href={base} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">← グループへ</Link><div><p className="text-sm font-semibold text-orange-700">{group.name}</p><h1 className="mt-2 text-3xl font-bold">みんなの思い出</h1><p className="mt-3 leading-7 text-stone-600">楽しかった日を、一冊ずつ振り返ろう。</p></div>
    <p className="text-sm text-stone-600">{result.total}冊</p>{result.memories.length?<ul className="grid gap-4 sm:grid-cols-2">{result.memories.map(memory=><li key={memory.id}><Link href={`${base}/memories/${memory.id}`} className="block h-full rounded-3xl border border-stone-200 border-l-8 border-l-orange-200 bg-white p-6 shadow-sm hover:border-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"><p className="text-sm text-stone-500"><time dateTime={memory.memory_date}>{memory.memory_date}</time></p><h2 className="mt-3 break-words text-xl font-bold">{memory.title}</h2><p className="mt-6 text-sm font-semibold text-orange-700">この一冊を開く →</p></Link></li>)}</ul>:<p className="rounded-3xl border bg-white p-6 leading-7 text-stone-600">{result.total?"このページには思い出がありません。":"思い出はまだありません。おでかけ計画を終了すると、記録した訪問先を一冊にまとめられます。"}</p>}
    <nav aria-label="思い出一覧のページ" className="flex flex-wrap gap-6">{page>1&&<Link href={`${base}/memories?page=${page-1}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">前の20冊</Link>}{page*20<result.total&&<Link href={`${base}/memories?page=${page+1}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">次の20冊</Link>}</nav><Link href={`${base}/outings`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">おでかけ計画へ</Link>
  </div>;
}
export default function MemoriesPage(props:{params:Promise<{groupId:string}>;searchParams:Promise<{page?:string}>}){return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status">思い出を読み込んでいます…</p>}><Content {...props}/></Suspense></div>;}
