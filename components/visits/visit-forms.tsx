"use client";
import {useActionState,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {saveNewVisitAction,updateVisitAction,rateVisitAction,type VisitActionState} from "@/app/app/groups/[groupId]/visits/actions";
import {completeVisitCreation,type SelectedVisitPhoto} from "@/lib/visits/creation";
import {VisitPhotoPicker} from "@/components/visits/visit-photo-picker";
import {uploadVisitPhotos} from "@/components/visits/upload-visit-photos";
import type {SavedVisit,VisitRatings} from "@/lib/visits/repository";
import {VisitTimeFields} from "@/components/visits/visit-time-fields";
const field="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700";
const button="min-h-12 rounded-full bg-orange-700 px-6 font-semibold text-white disabled:opacity-50";
function RatingOptions(){return <><option value="">未評価</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</>;}
export function CreateVisitForm({groupId,itemId,outingId,stopId,title,requestId,initialDate}:{groupId:string;itemId:string;outingId:string|null;stopId?:string|null;title:string;requestId:string;initialDate:string}){
  const [date,setDate]=useState(initialDate),[note,setNote]=useState(""),[rating,setRating]=useState("");
  const [time,setTime]=useState(""),[period,setPeriod]=useState("");
  const [visitRequestId]=useState(requestId);
  const [photos,setPhotos]=useState<SelectedVisitPhoto[]>([]),[savedId,setSavedId]=useState<string>(),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null);
  const submitting=useRef(false),router=useRouter();
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(submitting.current)return;
    const form=new FormData(event.currentTarget);submitting.current=true;setPending(true);setError(null);
    const result=await completeVisitCreation(savedId,()=>saveNewVisitAction(form),id=>uploadVisitPhotos(groupId,id,photos,photoId=>setPhotos(current=>current.map(photo=>photo.id===photoId?{...photo,done:true}:photo))),setSavedId);
    if(result.error){setError(result.error);setPending(false);submitting.current=false;return;}
    router.push(`/app/groups/${groupId}/visits/${result.visitId}`);router.refresh();
  }
  return <form onSubmit={submit} aria-busy={pending} className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
    <input type="hidden" name="groupId" value={groupId}/><input type="hidden" name="itemId" value={itemId}/><input type="hidden" name="outingId" value={outingId??""}/><input type="hidden" name="stopId" value={stopId??""}/><input type="hidden" name="visitId" value={visitRequestId}/>
    <h2 className="break-words text-xl font-bold">{title}</h2><p className="text-sm text-stone-600">写真とひとことを添えて、今日の思い出に。再訪も新しい記録として残せます。</p>
    <fieldset disabled={pending||!!savedId} className="min-w-0 space-y-5">
      <label className="block space-y-2 font-semibold"><span>訪問日（必須）</span><input type="date" name="date" required value={date} onChange={e=>setDate(e.target.value)} className={field}/></label>
      <VisitTimeFields time={time} period={period} onChange={(t,p)=>{setTime(t);setPeriod(p);}}/>
      <label className="block space-y-2 font-semibold"><span>訪問メモ</span><textarea name="note" rows={4} value={note} onChange={e=>setNote(e.target.value)} className={`${field} py-3`}/><span className="block text-xs font-normal text-stone-500">2,000文字以内。グループで共有します。</span></label>
      <label className="block space-y-2 font-semibold"><span>自分の評価（任意）</span><select name="rating" value={rating} onChange={e=>setRating(e.target.value)} className={field}><RatingOptions/></select></label>
    </fieldset>
    <VisitPhotoPicker photos={photos} onChange={setPhotos} disabled={pending||!!savedId}/>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <div role="status" className="text-sm text-stone-600">{pending&&(savedId?`写真を保存しています…（${photos.filter(photo=>photo.done).length} / ${photos.length}枚）`:"訪問記録を保存しています…")}</div>
    <button disabled={pending} className={button}>{pending?"保存中…":savedId?"残りの写真を再試行":"行った！を記録"}</button>
    {savedId&&!pending&&<p className="text-sm leading-6 text-stone-600">保存済みの内容は記録の詳細で編集できます。<Link href={`/app/groups/${groupId}/visits/${savedId}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">写真をあとで追加して、記録を見る →</Link><span className="block text-xs">移動すると未送信の写真選択は消えます。未完了の送信は詳細で確認・中断できます。</span></p>}
  </form>;
}
export function EditVisitForm({visit}:{visit:SavedVisit}){
  const [date,setDate]=useState(visit.visited_on),[note,setNote]=useState(visit.note),[expectedRevision,setExpectedRevision]=useState(visit.revision);
  const [time,setTime]=useState(visit.visited_time?.slice(0,5)??""),[period,setPeriod]=useState<string>(visit.visited_period??"");
  const [state,action,pending]=useActionState(async(previous:VisitActionState,form:FormData)=>{const result=await updateVisitAction(previous,form);if(result.savedRevision!==undefined)setExpectedRevision(result.savedRevision);return result;},{error:null});
  return <details className="rounded-3xl border border-stone-200 bg-white p-6"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-orange-700">訪問日・時間・メモを編集</summary><form action={action} aria-busy={pending} className="mt-4 space-y-4">
    <input type="hidden" name="groupId" value={visit.group_id}/><input type="hidden" name="visitId" value={visit.id}/><input type="hidden" name="revision" value={expectedRevision}/>
    <label className="block space-y-2 font-semibold"><span>訪問日</span><input type="date" required name="date" value={date} onChange={e=>setDate(e.target.value)} disabled={pending} className={field}/></label>
    <VisitTimeFields time={time} period={period} disabled={pending} onChange={(t,p)=>{setTime(t);setPeriod(p);}}/>
    <label className="block space-y-2 font-semibold"><span>メモ</span><textarea name="note" rows={4} value={note} onChange={e=>setNote(e.target.value)} disabled={pending} className={`${field} py-3`}/></label>
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.saved&&state.savedDate===date&&state.savedNote===note&&(state.savedTime??"")===time&&(state.savedPeriod??"")===period&&<p role="status" className="text-sm text-stone-600">訪問記録を保存しました。</p>}<button disabled={pending} className={button}>{pending?"保存中…":"変更を保存"}</button>
  </form></details>;
}
export function VisitRatingForm({groupId,visitId,ratings}:{groupId:string;visitId:string;ratings:VisitRatings}){
  const [rating,setRating]=useState(ratings.my_rating?.toString()??"");const [state,action,pending]=useActionState(rateVisitAction,{error:null});
  return <section className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-bold">訪問後の評価</h2><p className="text-sm text-stone-600">{ratings.rating_count?`平均 ${ratings.average_rating} / 5（${ratings.rating_count}人）`:"まだ評価はありません。"}</p><form action={action} aria-busy={pending} className="space-y-4">
    <input type="hidden" name="groupId" value={groupId}/><input type="hidden" name="visitId" value={visitId}/>
    <label className="block space-y-2 font-semibold"><span>自分の評価</span><select name="rating" value={rating} onChange={e=>setRating(e.target.value)} disabled={pending} className={field}><RatingOptions/></select></label>
    <p className="text-xs text-stone-500">任意で変更できます。「未評価」を保存すると取り消します。</p>
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.saved&&(state.savedRating?.toString()??"")===rating&&<p role="status" className="text-sm text-stone-600">評価を保存しました。</p>}<button disabled={pending} className={button}>{pending?"保存中…":"自分の評価を保存"}</button>
  </form></section>;
}
