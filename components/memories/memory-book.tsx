"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import type {SavedMemory} from "@/lib/memories/repository";
import type {SavedVisit,VisitPhoto} from "@/lib/visits/repository";
import {visitTimeLabel} from "@/lib/visits/time";
import {PrivateVisitImage} from "@/components/visits/private-visit-image";
export function MemoryBook({memory,visits,photos}:{memory:SavedMemory;visits:SavedVisit[];photos:VisitPhoto[]}){
  const [active,setActive]=useState("cover"),heading=useRef<HTMLHeadingElement>(null),changed=useRef(false);
  const pages=["cover","contents",...visits.map(v=>v.id),"afterword"],index=Math.max(0,pages.indexOf(active));
  const visit=visits.find(v=>v.id===active),chapter=visit?visits.indexOf(visit)+1:0;
  const title=index===0?memory.title:index===1?"目次":visit?visit.item_title:"あとがき";
  useEffect(()=>{if(changed.current)heading.current?.focus();},[active]);
  function turn(id:string){changed.current=true;setActive(id);}
  return <section aria-label={`${memory.title}の思い出の本`} className="space-y-4">
    <div className="min-h-[28rem] overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm"><div className="min-h-[28rem] border-l-[10px] border-orange-200 px-5 py-8 sm:border-l-[14px] sm:px-10">
      <p className="text-xs font-semibold tracking-widest text-orange-700">{index===0?"ここいこ · 思い出の一冊":index===1?"CONTENTS":visit?`CHAPTER ${String(chapter).padStart(2,"0")}`:"AFTERWORD"}</p>
      <h1 ref={heading} tabIndex={-1} className="mt-6 break-words text-3xl font-bold leading-tight tracking-tight outline-none sm:text-5xl">{title}</h1>
      {index===0?<div className="mt-20 space-y-4 border-t border-stone-200 pt-6 text-stone-600"><p><time dateTime={memory.memory_date}>{memory.memory_date}</time></p><p>訪問の記録 {visits.length}件 · 写真 {photos.length}枚</p><p className="text-sm leading-6">メモも写真も、あの日の一冊に。</p></div>:index===1?<div className="mt-8 space-y-4">{visits.length?<ol className="divide-y divide-stone-200">{visits.map((entry,n)=><li key={entry.id}><button type="button" onClick={()=>turn(entry.id)} className="flex min-h-16 w-full items-center gap-4 rounded-lg py-3 text-left font-semibold hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"><span className="text-orange-700">{String(n+1).padStart(2,"0")}</span><span className="min-w-0 break-words">{entry.item_title}<span className="mt-1 block text-xs font-normal text-stone-500">{entry.visited_on} · {visitTimeLabel(entry)}</span></span></button></li>)}</ol>:<p className="leading-7 text-stone-600">訪問記録はまだありません。計画から「行った！」を記録すると、この一冊にも反映されます。</p>}<button type="button" onClick={()=>turn("afterword")} className="min-h-11 font-semibold text-orange-700 underline">あとがきへ</button></div>:visit?<div className="mt-7 space-y-6"><p className="text-sm text-stone-500"><time dateTime={visit.visited_on}>{visit.visited_on}</time> · {visitTimeLabel(visit)}</p><p className="whitespace-pre-wrap break-words leading-8 text-stone-700">{visit.note||"この訪問のメモはまだありません。"}</p>{photos.some(p=>p.visit_id===visit.id)?<ul className="grid gap-4 sm:grid-cols-2">{photos.filter(p=>p.visit_id===visit.id).map((photo,n)=><li key={photo.id}><PrivateVisitImage path={photo.object_path} contentType={photo.content_type} alt={`${visit.item_title}の写真 ${n+1}`}/></li>)}</ul>:<p className="text-sm text-stone-500">写真はまだありません。</p>}<Link href={`/app/groups/${memory.group_id}/visits/${visit.id}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">訪問メモ・写真を編集</Link></div>:<div className="mt-10"><p className="whitespace-pre-wrap break-words leading-8 text-stone-700">{memory.note||"この日のあとがきはまだありません。"}</p><a href="#memory-edit" className="mt-8 inline-flex min-h-11 items-center font-semibold text-orange-700 underline">タイトル・あとがきを編集</a></div>}
    </div></div>
    <nav aria-label="思い出のページ" className="flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={index===0} onClick={()=>turn(pages[index-1])} className="min-h-12 rounded-full border border-stone-300 bg-white px-5 font-semibold disabled:opacity-40">← 前へ</button><p aria-live="polite" className="text-sm text-stone-600">{index+1} / {pages.length}</p><button type="button" disabled={index===pages.length-1} onClick={()=>turn(pages[index+1])} className="min-h-12 rounded-full border border-stone-300 bg-white px-5 font-semibold disabled:opacity-40">次へ →</button></nav>
    <details className="text-xs leading-6 text-stone-500"><summary className="min-h-11 cursor-pointer py-3">並び順について</summary><p>訪問日、入力した時間、計画の順番で並びます。時間なしは同日の最後です。時間帯だけの場合は、その時間帯の先頭に置きます（午前は12時まで、昼は12〜13時、午後は13〜18時、夜は18時以降）。同じ訪問の写真は追加順です。</p></details>
  </section>;
}
