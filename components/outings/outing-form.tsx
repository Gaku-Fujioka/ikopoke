"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { planSelection } from "@/lib/items/plan-selection";
import { CalendarDays, MapPin, UsersRound, StickyNote } from "lucide-react";
import { saveTripAction, cancelOutingAction } from "@/app/app/groups/[groupId]/outings/trip-actions";
import { OUTING_MODES, OUTING_PERIODS, type OutingMode, type OutingPeriod } from "@/lib/outings/validation";
import { dateDistance, shiftDay, type TripDay, type TripStop } from "@/lib/outings/trips";
import type { CandidateOption, OutingDetail } from "@/lib/outings/repository";
import type { GroupMember } from "@/lib/profiles/repository";
const field="kk-field";
export type OutingEditSection = "all" | "title" | "dates" | "memo" | "participants" | "day";
function People({members,selected,onChange,disabled}:{members:GroupMember[];selected:string[];onChange:(ids:string[])=>void;disabled:boolean}){
  const choices=[...members,...selected.filter(id=>!members.some(m=>m.user_id===id)).map(id=>({user_id:id,display_name:"退出したメンバー"}))];
  return <div className="kk-people-choices">{choices.map(member=><label key={member.user_id} data-selected={selected.includes(member.user_id)}><input type="checkbox" checked={selected.includes(member.user_id)} disabled={disabled||!member.display_name} onChange={event=>onChange(event.target.checked?[...selected,member.user_id]:selected.filter(id=>id!==member.user_id))}/><span>{member.display_name??"表示名未設定（本人の設定待ち）"}</span></label>)}</div>;
}
function seedId(seed:string,index:number){return seed.slice(0,24)+((parseInt(seed.slice(24),16)+index+1)%281474976710656).toString(16).padStart(12,'0');}
export function OutingForm({groupId,outingId,current,candidates,members,actorId,initialItemId,initialItemIds=[],initialDate,initialDay=0,section="all",draftId=outingId}:{groupId:string;outingId:string;current:OutingDetail|null;candidates:CandidateOption[];members:GroupMember[];actorId:string;initialItemId?:string;initialItemIds?:string[];initialDate?:string;initialDay?:number;section?:OutingEditSection;draftId?:string}){
  const defaults=current?.participants??(members.some(m=>m.user_id===actorId&&m.display_name)?[actorId]:[]);
  const [title,setTitle]=useState(current?.outing.title??""),[start,setStart]=useState(current?.outing.outing_date??initialDate??""),[end,setEnd]=useState(current?.outing.end_date??initialDate??""),[memo,setMemo]=useState(current?.outing.memo??"");
  const [participants,setParticipants]=useState(defaults),[active,setActive]=useState(initialDay),[toAdd,setToAdd]=useState(""),[removed,setRemoved]=useState<string[]>([]);
  const [days,setDays]=useState<TripDay[]>(()=>{
    const result:TripDay[]=current?current.days.map(day=>({mode:day.mode,participants:day.participants,items:current.items.filter(s=>s.day_index===day.day_index).map(s=>({id:s.id,item_id:s.item_id,planned_time:s.planned_time?.slice(0,5)??null,period:s.period}))})):[{mode:"order",participants:defaults,items:[]}];
    const ids=[...new Set([...initialItemIds,...(initialItemId?[initialItemId]:[])])].filter(id=>candidates.some(c=>c.id===id&&!c.archived_at));
    result[initialDay].items.push(...ids.map((id,index)=>({id:seedId(draftId,index),item_id:id,planned_time:null,period:null})));
    return result;
  });
  const router = useRouter();
  const [state,action,pending]=useActionState(async (previous: {error:string|null}, form:FormData) => {
    const result = await saveTripAction(previous, form);
    if (result.redirectTo) { planSelection.clear(groupId); router.push(result.redirectTo); }
    return result;
  },{error:null});
  const duration=dateDistance(start,end)+1,validDuration=Number.isInteger(duration)&&duration>0&&duration<=366;
  const day=days[active]??days[0],total=days.reduce((n,d)=>n+d.items.length,0),outside=validDuration&&days.slice(duration).some(d=>d.items.length>0);
  const incompleteDays=days.slice(0,validDuration?duration:days.length).flatMap((d,index)=>!d.participants.length||d.items.some(s=>d.mode==='exact'&&!s.planned_time||d.mode==='period'&&!s.period)?[index]:[]);
  const all=section==='all', showBasics=all||['title','dates','memo'].includes(section), showPeople=all||section==='participants', showDays=all||section==='day'||section==='participants'||section==='dates';
  function updateDay(change:Partial<TripDay>){setDays(before=>before.map((d,index)=>index===active?{...d,...change}:d));}
  function changeStart(value:string){const length=Number.isInteger(duration)&&duration>0?duration:days.length;setStart(value);const shifted=shiftDay(value,length-1);if(shifted)setEnd(shifted);}
  function changeEnd(value:string){setEnd(value);const count=dateDistance(start,value)+1;if(count>0&&count<=366)setDays(before=>count<=before.length?before:[...before,...Array.from({length:count-before.length},()=>({mode:"order" as const,participants:[...participants],items:[]}))]);}
  function changeStop(index:number,change:Partial<TripStop>){updateDay({items:day.items.map((slot,at)=>at===index?{...slot,...change}:slot)});}
  function move(index:number,offset:number){const items=[...day.items];[items[index],items[index+offset]]=[items[index+offset],items[index]];updateDay({items});}
  function moveDay(index:number,target:number){setDays(before=>{const slot=before[active].items[index];return before.map((d,n)=>n===active?{...d,items:d.items.filter((_,i)=>i!==index)}:n===target?{...d,items:[...d.items,slot]}:d);});}
  return <form action={action} aria-busy={pending} className="space-y-6">
    <input type="hidden" name="groupId" value={groupId}/><input type="hidden" name="outingId" value={outingId}/><input type="hidden" name="expectedRevision" value={current?.outing.revision??0}/><input type="hidden" name="days" value={JSON.stringify(validDuration?days.slice(0,duration):days)}/><input type="hidden" name="participants" value={JSON.stringify(participants)}/><input type="hidden" name="removedIds" value={JSON.stringify(removed)}/><input type="hidden" name="selectedIds" value={initialItemIds.join(",")}/>
    {!(all||section==='title')&&<input type="hidden" name="title" value={title}/>}{!(all||section==='dates')&&<><input type="hidden" name="start" value={start}/><input type="hidden" name="end" value={end}/></>}{!(all||section==='memo')&&<input type="hidden" name="memo" value={memo}/>}
    {initialItemIds.length>0&&<p className="kk-selection-summary">{initialItemIds.length}件の候補を{initialDay+1}日目に引き継ぎました。まだ保存されていません。時間と順番を確認して保存してください。</p>}
    {incompleteDays.length>0&&<div className="kk-notice space-y-2"><p className="text-sm">参加者、または選んだモードの時刻・時間帯が未入力の日があります。</p><div className="flex flex-wrap gap-2">{incompleteDays.map(index=><button key={index} type="button" onClick={()=>setActive(index)} className="kk-text-link">{index+1}日目の入力を確認 →</button>)}</div></div>}
    <fieldset disabled={pending} className={all?"kk-plan-editor":"space-y-6"}>
      {(showBasics||showPeople)&&<div className="space-y-5">
        {showBasics&&<section className="kk-editor-panel kk-editor-basics"><div className="kk-editor-heading"><CalendarDays aria-hidden="true"/><h2>おでかけのこと</h2></div>
          {(all||section==='title')&&<label className="block space-y-2"><span className="font-semibold">計画の名前 <small>必須</small></span><input name="title" required value={title} onChange={e=>setTitle(e.target.value)} className={field} placeholder="例：京都でのんびり3日間"/></label>}
          {(all||section==='dates')&&<><div className="grid grid-cols-2 gap-3"><label className="block space-y-2"><span className="font-semibold">開始日</span><input name="start" type="date" required value={start} onChange={e=>changeStart(e.target.value)} className={field}/></label><label className="block space-y-2"><span className="font-semibold">終了日</span><input name="end" type="date" required min={start||undefined} value={end} onChange={e=>changeEnd(e.target.value)} className={field}/></label></div><p className="kk-field-help">日帰りは同じ日を選択。開始日を変えると、日ごとの内容を保って旅行全体を移動します。最大366日。</p></>}
          {(all||section==='memo')&&<label className="block space-y-2"><span className="flex items-center gap-2 font-semibold"><StickyNote size={16} aria-hidden="true"/>みんなへのメモ <small>任意</small></span><textarea name="memo" value={memo} onChange={e=>setMemo(e.target.value)} rows={3} className={field} placeholder="集合場所や持ち物など"/><span className="kk-field-help">2,000文字以内</span></label>}
        </section>}
        {showPeople&&<section className="kk-editor-panel kk-editor-people"><div className="kk-editor-heading"><UsersRound aria-hidden="true"/><h2>誰と行く？</h2></div><People members={members} selected={participants} onChange={setParticipants} disabled={pending}/><p className="kk-field-help">旅行全体の参加者です。新しい日にも引き継ぎます。日ごとの変更は各日のプランから。</p><button type="button" disabled={pending||!participants.length} onClick={()=>setDays(before=>before.map(d=>({...d,participants:[...participants]})))} className="kk-text-link">この参加者をすべての日にコピー</button></section>}
      </div>}
      {showDays&&<section className="kk-editor-panel kk-editor-route"><div className="kk-editor-heading"><MapPin aria-hidden="true"/><h2>日ごとのプラン</h2><span className="kk-label">全{total}件 / 50件</span></div>
        {outside&&<p role="alert" className="kk-notice">期間外に行き先が残っています。該当日から別の日へ移すか「外す」を選んでから保存してください。</p>}
        <nav aria-label="編集する日" className="kk-day-tabs">{days.map((d,index)=><button key={index} type="button" aria-pressed={active===index} onClick={()=>setActive(index)}><strong>{index+1}日目{validDuration&&index>=duration?"（期間外）":""}</strong><small>{shiftDay(start,index)||"日付未定"} · {d.items.length}件</small></button>)}</nav>
        <div className="kk-day-options">{section!=="participants"&&<><label className="block space-y-2"><span className="text-sm font-semibold">この日の時間の決め方</span><select value={day.mode} onChange={e=>updateDay({mode:e.target.value as OutingMode})} className={field}>{OUTING_MODES.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></label><p className="kk-field-help">モードを変えても、入力済みの時刻・時間帯は保持します。</p></>}<details open={section==='participants'}><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{active+1}日目の参加者 · {day.participants.length}人を変更</summary><People members={members} selected={day.participants} onChange={ids=>updateDay({participants:ids})} disabled={pending}/></details></div>
        {section!=='participants'&&<><ol className="kk-edit-itinerary">{day.items.map((slot,index)=>{const candidate=candidates.find(c=>c.id===slot.item_id);return <li key={slot.id}><span className="kk-stop-number">{index+1}</span><div className="min-w-0 space-y-3"><p className="break-words font-bold">{candidate?.title??"候補"}{candidate?.archived_at?"（アーカイブ）":""}</p>
          {day.mode==='exact'&&<label className="block text-sm">時刻<input type="time" required value={slot.planned_time??""} onChange={e=>changeStop(index,{planned_time:e.target.value||null})} className={field}/></label>}{day.mode==='period'&&<label className="block text-sm">時間帯<select required value={slot.period??""} onChange={e=>changeStop(index,{period:e.target.value as OutingPeriod||null})} className={field}><option value="">選んでください</option>{OUTING_PERIODS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label>}
          <div className="flex flex-wrap gap-2"><button type="button" disabled={pending||index===0} onClick={()=>move(index,-1)} className="kk-order-button" aria-label={index+1+"番目を前へ"}>↑ 前へ</button><button type="button" disabled={pending||index===day.items.length-1} onClick={()=>move(index,1)} className="kk-order-button" aria-label={index+1+"番目を後ろへ"}>↓ 後ろへ</button>{days.length>1&&<label className="flex items-center gap-2 text-sm">移動先<select aria-label={candidate?.title+"の移動先の日"} value={active} onChange={e=>moveDay(index,Number(e.target.value))} className="min-h-11 rounded-xl border px-2">{days.map((_,n)=><option key={n} value={n}>{n+1}日目</option>)}</select></label>}<button type="button" onClick={()=>{updateDay({items:day.items.filter(s=>s.id!==slot.id)});if(current?.items.some(s=>s.id===slot.id))setRemoved(before=>[...before,slot.id]);}} className="min-h-11 px-3 text-sm text-red-700">外す</button></div>
        </div></li>;})}</ol>
        {!day.items.length&&<div className="kk-route-empty"><MapPin aria-hidden="true"/><strong>この日の楽しみを足そう</strong><p>保存した候補から、行き先を選べます。</p></div>}
        <div className="kk-route-add"><label className="min-w-0 flex-1 space-y-2 text-sm"><span className="block font-semibold">行き先を追加</span><select value={toAdd} onChange={e=>setToAdd(e.target.value)} className={field}><option value="">候補を選ぶ</option>{candidates.filter(c=>!c.archived_at).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><button type="button" disabled={pending||!toAdd||total>=50} onClick={()=>{updateDay({items:[...day.items,{id:crypto.randomUUID(),item_id:toAdd,planned_time:null,period:null}]});setToAdd("");}} className="kk-primary-link">＋ 追加</button></div><p className="kk-field-help">同じ場所も何度でも追加できます。別の日も、上の日付から切り替えて組み立てよう。</p></>}
      </section>}
    </fieldset>
    {!members.find(m=>m.user_id===actorId)?.display_name&&<p className="kk-notice">先に<Link href="/app/profile" className="underline">自分の表示名を設定</Link>してください。</p>}
    {state.error&&<p role="alert" className="kk-notice text-red-700">{state.error}</p>}
    <div className="kk-save-bar"><p>{validDuration?duration+"日間 · ":"日程を選んでください · "}{total}か所 · {participants.length}人{total<1?" · 行き先を追加しよう":total>50?" · 行き先は50件以内です":""}</p><button disabled={pending||!validDuration||outside||total<1||total>50||!participants.length||incompleteDays.length>0} className="kk-primary-link">{pending?"保存中…":current?"変更を保存":"この計画で出かけよう →"}</button></div>
  </form>;
}
export function OutingCancellation({groupId,outingId,revision,cancelled}:{groupId:string;outingId:string;revision:number;cancelled:boolean}){
  const [state,action,pending]=useActionState(cancelOutingAction,{error:null});
  return <details className="kk-surface"><summary className="min-h-11 cursor-pointer py-2 font-semibold">{cancelled?"おでかけを再開する":"おでかけを中止する"}</summary><form action={action} aria-busy={pending} className="space-y-3"><input type="hidden" name="groupId" value={groupId}/><input type="hidden" name="outingId" value={outingId}/><input type="hidden" name="revision" value={revision}/><input type="hidden" name="cancelled" value={cancelled?'0':'1'}/><p className="text-sm leading-6">{cancelled?"再開すると次のおでかけとカレンダーに戻ります。":"中止すると次のおでかけと通常のカレンダーから外れます。計画・訪問・写真・アルバムは残ります。中止一覧から再開できます。"}</p><label className="flex min-h-11 items-center gap-3 text-sm"><input name="confirm" value="yes" type="checkbox" required/>内容を確認しました</label><button disabled={pending} className="kk-primary-link">{pending?"変更中…":cancelled?"再開する":"中止する"}</button>{state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.saved&&<p role="status">変更を保存しました。</p>}</form></details>;
}
