import { shiftDay } from "@/lib/outings/trips";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, UsersRound } from "lucide-react";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getGroup } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { getGroupMembers } from "@/lib/profiles/repository";
import { getOuting, listCandidateOptions } from "@/lib/outings/repository";
import { OUTING_MODES, OUTING_PERIODS } from "@/lib/outings/validation";
import { prettyDate } from "@/lib/home/navigation";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { OutingForm, OutingCancellation } from "@/components/outings/outing-form";
import { VisitHistory } from "@/components/visits/visit-sections";
import { CompletionForm } from "@/components/memories/memory-forms";

async function OutingContent({ params }: { params: Promise<{ groupId: string; outingId: string }> }) {
  const { groupId, outingId } = await params;
  if (!isGroupId(groupId) || !isGroupId(outingId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(`/app/groups/${groupId}/outings/${outingId}`)}`);
  let group, current, candidates, members;
  try {
    [group, current, candidates, members] = await Promise.all([getGroup(client, groupId), getOuting(client, groupId, outingId), listCandidateOptions(client, groupId), getGroupMembers(client, groupId)]);
  } catch {
    return <p role="alert" className="kk-notice">計画を読み込めませんでした。計画一覧から開き直してください。</p>;
  }
  if (!group || !current) notFound();
  const base = `/app/groups/${groupId}`, { outing } = current;
  return <div className="space-y-6">
    <Link href={`${base}/outings`} className="kk-text-link">← おでかけへ</Link>
    <div className="kk-page-heading"><p className="kk-eyebrow">{group.name}と {outing.completed_at ? "過ごした日" : "楽しむ一日"}</p><h1>{outing.title}</h1></div>
    <section aria-label="日付と参加者" className="kk-surface space-y-3">
      <p className="flex items-center gap-2 font-bold"><CalendarDays aria-hidden="true" size={19} /><time dateTime={outing.outing_date}>{prettyDate(outing.outing_date)}</time>{outing.end_date !== outing.outing_date && <>〜<time dateTime={outing.end_date}>{prettyDate(outing.end_date)}</time></>}<span className="kk-label">{outing.cancelled_at ? "中止中" : outing.completed_at ? "終了済み" : "計画中"}</span></p>
      <p className="flex items-start gap-2 text-sm text-stone-600"><UsersRound aria-hidden="true" size={18} className="shrink-0" /><span>{current.participants.map(id => members.find(member => member.user_id === id)?.display_name ?? "退出したメンバー").join("、")}</span></p>
      {outing.memo && <p className="whitespace-pre-wrap text-sm leading-7 text-stone-600">{outing.memo}</p>}
    </section>
    {current.days.map(day=><section key={day.day_index} aria-label={day.day_index+1+"日目のプラン"} className="kk-surface space-y-3"><div className="kk-row"><h2 className="text-lg font-bold">{day.day_index+1}日目 · {shiftDay(outing.outing_date,day.day_index)}</h2><span className="kk-label">{OUTING_MODES.find(m=>m.value===day.mode)?.label}</span></div><p className="text-sm text-stone-600">{day.participants.map(id=>members.find(m=>m.user_id===id)?.display_name??"退出したメンバー").join("、")}</p><ol className="kk-itinerary">{current.items.filter(s=>s.day_index===day.day_index).map((slot,index)=>{
      const title=candidates.find(c=>c.id===slot.item_id)?.title??"候補",time=day.mode==='exact'?slot.planned_time?.slice(0,5):day.mode==='period'?OUTING_PERIODS.find(p=>p.value===slot.period)?.label:null;
      return <li key={slot.id}><span className="kk-stop-number">{index+1}</span><div><p className="kk-eyebrow">{time||"順番で楽しむ"}</p><Link href={base+'/items/'+slot.item_id} className="kk-stop-title">{title}</Link><Link href={base+'/visits/new?'+new URLSearchParams({item:slot.item_id,outing:outingId,stop:slot.id,date:shiftDay(outing.outing_date,day.day_index)})} className="kk-text-link">行った！を残す →</Link></div></li>;
    })}</ol>{!current.items.some(s=>s.day_index===day.day_index)&&<p className="kk-muted">この日は予定なし。旅の余白も楽しもう。</p>}</section>)}
    {!outing.completed_at && !outing.cancelled_at ? <details id="edit-plan" className="kk-surface"><summary className="min-h-11 cursor-pointer py-2 font-semibold">計画を編集する</summary><div className="mt-4"><OutingForm key={outing.revision} groupId={groupId} outingId={outingId} current={current} candidates={candidates} members={members} actorId={data.claims.sub} /></div></details> : <p className="kk-muted">{outing.cancelled_at ? "中止中です。下の「おでかけを再開する」から編集に戻れます。" : "計画を直すときは、下の「終了を取り消す」で戻せます。"}</p>}
    <Suspense fallback={<p role="status" className="kk-loading">この日の訪問記録を読み込んでいます…</p>}><VisitHistory client={client} groupId={groupId} outingId={outingId} /></Suspense>
    {!outing.cancelled_at && <CompletionForm groupId={groupId} outingId={outingId} revision={outing.revision} completed={!!outing.completed_at} />}
    {!outing.completed_at && <OutingCancellation groupId={groupId} outingId={outingId} revision={outing.revision} cancelled={Boolean(outing.cancelled_at)} />}
    <Link href={`${base}/memories`} className="kk-text-link">みんなの思い出へ →</Link>
  </div>;
}
export default function OutingPage({ params }: { params: Promise<{ groupId: string; outingId: string }> }) {
  return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status" className="kk-loading">おでかけを読み込んでいます…</p>}><OutingContent params={params} /></Suspense></div>;
}
