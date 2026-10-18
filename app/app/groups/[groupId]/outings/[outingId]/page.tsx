import { OutingMapSection } from "@/components/maps/map-sections";
import { PlanSelectionReceipt } from "@/components/items/candidate-board";
import { selectedCandidateIds } from "@/lib/outings/selection";
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
import { OutingCancellation } from "@/components/outings/outing-form";
import { VisitHistory } from "@/components/visits/visit-sections";
import { CompletionForm } from "@/components/memories/memory-forms";

type PageProps = { params: Promise<{ groupId: string; outingId: string }>; searchParams: Promise<{ planned?: string }> };
async function OutingContent({ params, searchParams }: PageProps) {
  const planned = selectedCandidateIds((await searchParams)?.planned);

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
  const editable = !outing.completed_at && !outing.cancelled_at;
  const edit = (section:string, day=0) => base+'/outings/'+outingId+'/edit?'+new URLSearchParams({section,day:String(day)});
  return <div className="space-y-7">
    {planned.length>0&&<PlanSelectionReceipt groupId={groupId} ids={planned}/>}
    <Link href={base+'/outings'} className="kk-text-link">← おでかけへ</Link>
    <header className="kk-page-heading"><p className="kk-eyebrow">{group.name}と {outing.completed_at ? "過ごした日" : "楽しむ日々"}</p><div className="kk-section-heading"><h1>{outing.title}</h1>{editable&&<Link href={edit('title')} className="kk-edit-button">名前を編集</Link>}</div><span className="kk-label">{outing.cancelled_at ? "中止中" : outing.completed_at ? "終了済み" : "計画中"}</span></header>
    <section aria-label="日付と参加者" className="kk-plan-overview">
      <div className="kk-overview-row"><div><p className="kk-overview-label">いつ行く？</p><p className="flex flex-wrap items-center gap-2 font-bold"><CalendarDays aria-hidden="true" size={19} /><time dateTime={outing.outing_date}>{prettyDate(outing.outing_date)}</time>{outing.end_date !== outing.outing_date && <>〜<time dateTime={outing.end_date}>{prettyDate(outing.end_date)}</time></>}</p></div>{editable&&<Link href={edit('dates')} className="kk-edit-button">日程を変更</Link>}</div>
      <div className="kk-overview-row"><div><p className="kk-overview-label">一緒に行くメンバー</p><p className="flex items-start gap-2 text-sm"><UsersRound aria-hidden="true" size={18} className="shrink-0" /><span>{current.participants.map(id=>members.find(m=>m.user_id===id)?.display_name??"退出したメンバー").join("、")}</span></p></div>{editable&&<Link href={edit('participants')} className="kk-edit-button">参加者を変更</Link>}</div>
      <div className="kk-overview-row"><div><p className="kk-overview-label">みんなへのメモ</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{outing.memo||"集合場所や持ち物など、ひとこと残そう。"}</p></div>{editable&&<Link href={edit('memo')} className="kk-edit-button">メモを編集</Link>}</div>
    </section>
    {current.days.length>1&&<nav aria-label="旅の日程" className="kk-chips">{current.days.map(day=><Link key={day.day_index} href={'#day-'+day.day_index} className="kk-chip">{day.day_index+1}日目 · {shiftDay(outing.outing_date,day.day_index)}</Link>)}</nav>}
    {current.days.map(day=><section id={'day-'+day.day_index} key={day.day_index} aria-label={day.day_index+1+"日目のプラン"} className="kk-plan-day scroll-mt-6 space-y-5"><div className="kk-section-heading"><div><p className="kk-eyebrow">{shiftDay(outing.outing_date,day.day_index)}</p><h2>{day.day_index+1}日目の楽しみ</h2></div>{editable&&<Link href={edit('day',day.day_index)} className="kk-edit-button">行き先・時間を編集</Link>}</div><div className="flex flex-wrap items-center gap-3"><span className="kk-label">{OUTING_MODES.find(m=>m.value===day.mode)?.label}</span><span className="text-xs text-stone-600">{day.participants.map(id=>members.find(m=>m.user_id===id)?.display_name??"退出したメンバー").join("、")}</span>{editable&&<Link href={edit('participants',day.day_index)} className="kk-text-link">この日の参加者を変更</Link>}</div><Suspense fallback={<p role="status" className="kk-loading">この日の場所を読み込んでいます…</p>}><OutingMapSection client={client} groupId={groupId} group={{id:groupId,name:group.name}} items={current.items.filter(s=>s.day_index===day.day_index)} /></Suspense><ol className="kk-itinerary">{current.items.filter(s=>s.day_index===day.day_index).map((slot,index)=>{
      const title=candidates.find(c=>c.id===slot.item_id)?.title??"候補",time=day.mode==='exact'?slot.planned_time?.slice(0,5):day.mode==='period'?OUTING_PERIODS.find(p=>p.value===slot.period)?.label:null;
      return <li key={slot.id}><span className="kk-stop-number">{index+1}</span><div><p className="kk-eyebrow">{time||"順番で楽しむ"}</p><Link href={base+'/items/'+slot.item_id} className="kk-stop-title">{title}</Link><Link href={base+'/visits/new?'+new URLSearchParams({item:slot.item_id,outing:outingId,stop:slot.id,date:shiftDay(outing.outing_date,day.day_index)})} className="kk-text-link">行った！を残す →</Link></div></li>;
    })}</ol>{!current.items.some(s=>s.day_index===day.day_index)&&<p className="kk-muted">この日は予定なし。旅の余白も楽しもう。</p>}{editable&&<Link href={edit('day',day.day_index)} className="kk-secondary-link">＋ この日に行き先を追加</Link>}</section>)}
    {!editable&&<p className="kk-muted">{outing.cancelled_at?"中止中です。下の管理メニューから再開できます。":"計画を直すときは、終了を取り消すと編集に戻れます。"}</p>}
    <Suspense fallback={<p role="status" className="kk-loading">この日の訪問記録を読み込んでいます…</p>}><VisitHistory client={client} groupId={groupId} outingId={outingId}/></Suspense>
    {!outing.cancelled_at&&<CompletionForm groupId={groupId} outingId={outingId} revision={outing.revision} completed={!!outing.completed_at}/>}
    {!outing.completed_at&&<details className="kk-inline-editor"><summary className="kk-edit-button">… おでかけの管理</summary><OutingCancellation groupId={groupId} outingId={outingId} revision={outing.revision} cancelled={Boolean(outing.cancelled_at)}/></details>}
    <Link href={base+'/memories'} className="kk-text-link">みんなの思い出へ →</Link>
  </div>;
}
export default function OutingPage(props: PageProps) {
  return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status" className="kk-loading">おでかけを読み込んでいます…</p>}><OutingContent {...props} /></Suspense></div>;
}
