import {CompletionForm} from "@/components/memories/memory-forms";
import {OUTING_MODES,OUTING_PERIODS} from "@/lib/outings/validation";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getGroup } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { getGroupMembers } from "@/lib/profiles/repository";
import { getOuting, listCandidateOptions } from "@/lib/outings/repository";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { OutingForm } from "@/components/outings/outing-form";
import { VisitHistory } from "@/components/visits/visit-sections";

async function OutingContent({ params }: { params: Promise<{ groupId: string; outingId: string }> }) {
  const { groupId, outingId } = await params;
  if (!isGroupId(groupId) || !isGroupId(outingId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(`/app/groups/${groupId}/outings/${outingId}`)}`);
  let group, current, candidates, members;
  try {
    [group, current, candidates, members] = await Promise.all([getGroup(client,groupId),getOuting(client,groupId,outingId),listCandidateOptions(client,groupId),getGroupMembers(client,groupId)]);
  } catch {
    return <p role="alert" className="rounded-3xl border bg-white p-6">計画を読み込めませんでした。計画一覧から開き直してください。</p>;
  }
  if (!group || !current) notFound();
  return <div className="space-y-6"><Link href={`/app/groups/${groupId}/outings`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">← 計画一覧へ</Link><div><p className="text-sm font-semibold text-orange-700">{group.name}</p><h1 className="mt-2 break-words text-3xl font-bold">{current.outing.title}</h1><p className="mt-2 text-stone-600">{current.outing.completed_at ? "終了済みです。計画を編集する場合は、下の「終了を取り消す」で戻してください。" : "計画を編集できます。保存するとグループ全員に反映されます。"}</p></div>{!current.outing.completed_at && <OutingForm key={current.outing.revision} groupId={groupId} outingId={outingId} current={current} candidates={candidates} members={members} actorId={data.claims.sub} />}
{current.outing.completed_at && <section className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-bold">保存した計画</h2><p>{current.outing.outing_date} · {OUTING_MODES.find(mode=>mode.value===current.outing.mode)?.label}</p><p className="whitespace-pre-wrap break-words leading-7 text-stone-700">{current.outing.memo||"計画のメモはありません。"}</p><ol className="list-inside list-decimal space-y-3">{current.items.map(slot=><li key={slot.item_id} className="break-words">{candidates.find(item=>item.id===slot.item_id)?.title??"候補"}{current.outing.mode==="exact"&&` · ${slot.planned_time?.slice(0,5)??""}`}{current.outing.mode==="period"&&` · ${OUTING_PERIODS.find(period=>period.value===slot.period)?.label??""}`}</li>)}</ol><p className="break-words text-sm text-stone-600">参加者：{current.participants.map(id=>members.find(member=>member.user_id===id)?.display_name??"表示名未設定").join("、")}</p></section>}<CompletionForm groupId={groupId} outingId={outingId} revision={current.outing.revision} completed={!!current.outing.completed_at}/><Link href={`/app/groups/${groupId}/memories`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">みんなの思い出へ</Link>
    <section className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-bold">このおでかけの訪問を記録</h2><ul className="space-y-2">{current.items.map(slot=><li key={slot.item_id}><Link href={`/app/groups/${groupId}/visits/new?item=${slot.item_id}&outing=${outingId}&date=${current.outing.outing_date}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">{candidates.find(item=>item.id===slot.item_id)?.title??"候補"}の「行った！」を記録</Link></li>)}</ul></section>
    <Suspense fallback={<p role="status">訪問記録を読み込んでいます…</p>}><VisitHistory client={client} groupId={groupId} outingId={outingId}/></Suspense>
  </div>;
}
export default function OutingPage({ params }: { params: Promise<{ groupId: string; outingId: string }> }) {
  return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status">計画を読み込んでいます…</p>}><OutingContent params={params} /></Suspense></div>;
}
