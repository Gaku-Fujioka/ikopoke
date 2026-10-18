import { DeleteVisitContent } from "@/components/visits/photo-management";
import {Suspense} from "react";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {hasEnvVars} from "@/lib/utils";
import {isGroupId} from "@/lib/groups/validation";
import {getGroup} from "@/lib/groups/repository";
import {getVisit} from "@/lib/visits/repository";
import {visitTimeLabel} from "@/lib/visits/time";
import {AuthSetupNotice} from "@/components/auth-setup-notice";
import {EditVisitForm} from "@/components/visits/visit-forms";
import {VisitPhotos,VisitRatingSection} from "@/components/visits/visit-sections";
async function Content({params}:{params:Promise<{groupId:string;visitId:string}>}){
  const {groupId,visitId}=await params;if(!isGroupId(groupId)||!isGroupId(visitId))notFound();
  if(!hasEnvVars)return <AuthSetupNotice/>;
  const client=await createClient(),{data,error}=await client.auth.getClaims();
  if(error||!data?.claims?.sub)redirect(`/auth/login?next=${encodeURIComponent(`/app/groups/${groupId}/visits/${visitId}`)}`);
  let group,visit;try{[group,visit]=await Promise.all([getGroup(client,groupId),getVisit(client,groupId,visitId)]);}catch{return <p role="alert">訪問記録を読み込めませんでした。もう一度お試しください。</p>;}
  if(!group||!visit)notFound();
  const permissions=await client.rpc("get_visit_permissions",{p_group_id:groupId,p_visit_id:visitId});
  return <div className="space-y-6"><Link href={`/app/groups/${groupId}/visits`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">← 訪問記録の一覧へ</Link>
    <article className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8"><p className="text-sm font-semibold text-orange-700">{group.name} / 行った！</p><h1 className="break-words text-3xl font-bold">{visit.item_title}</h1><time dateTime={visit.visited_on} className="block font-semibold">{visit.visited_on} · {visitTimeLabel(visit)}</time><p className="whitespace-pre-wrap break-words leading-7 text-stone-700">{visit.note||"メモはまだありません。"}</p><div className="flex flex-wrap gap-4"><Link href={`/app/groups/${groupId}/items/${visit.item_id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-orange-700 underline">元の候補を開く</Link>{visit.outing_id&&<Link href={`/app/groups/${groupId}/outings/${visit.outing_id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-orange-700 underline">おでかけ計画を開く</Link>}</div><p className="text-xs text-stone-500">名前は訪問を記録した時点のものです。</p></article>
    {visit.deleting ? <p role="status" className="kk-notice">削除処理が途中です。下の「訪問記録を削除」から同じ操作を再試行してください。</p> : <EditVisitForm visit={visit}/>}
    {permissions.error ? <p role="status">削除権限を確認できませんでした。再読み込みしてください。</p> : permissions.data?.[0]?.can_delete && <DeleteVisitContent groupId={groupId} visitId={visitId} revision={visit.revision}/>}
    <Link href={"/app/finance/open?"+new URLSearchParams({source:"visit:"+visitId})} className="kk-surface block space-y-2"><strong>この訪問の、自分の会計 →</strong><p className="text-sm text-stone-600">食事代や買い物代を、自分用に残せます。金額はあなただけに表示されます。</p></Link>
    <Suspense fallback={<p role="status">評価を読み込んでいます…</p>}>{!visit.deleting && <VisitRatingSection client={client} groupId={groupId} visitId={visitId}/>}</Suspense>
    <Suspense fallback={<p role="status">写真を読み込んでいます…</p>}>{!visit.deleting && <VisitPhotos client={client} groupId={groupId} visitId={visitId} title={visit.item_title}/>}</Suspense>
  </div>;
}
export default function VisitPage({params}:{params:Promise<{groupId:string;visitId:string}>}){return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status">訪問記録を読み込んでいます…</p>}><Content params={params}/></Suspense></div>;}
