"use client";
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import type {SavedMemory} from '@/lib/memories/repository';
import type {SavedVisit,VisitPhoto} from '@/lib/visits/repository';
import {bookChapters,type BookContent} from '@/lib/memories/book';
import {visitTimeLabel} from '@/lib/visits/time';
import {PrivateVisitImage} from '@/components/visits/private-visit-image';
import {BookWords,BookPageEditor,InsertBookPage,BookPhotoUpload,BookPhotoControls,RemoveBookPage} from './book-writing';

export function MemoryBook({memory,visits,photos,book={pages:[],words:[],photos:[]}}:{memory:SavedMemory;visits:SavedVisit[];photos:VisitPhoto[];book?:BookContent}){
 const [active,setActive]=useState('cover'),heading=useRef<HTMLHeadingElement>(null),changed=useRef(false);
 const chapters=bookChapters(visits,book.pages),pages=['cover','contents',...chapters.map(p=>p.id),'afterword'];
 const index=Math.max(0,pages.indexOf(active)),shown=pages[index];
 const cover=photos.find(p=>p.id===memory.cover_photo_id),page=chapters.find(p=>p.id===shown),visit=visits.find(v=>v.id===page?.visit_id);
 const title=shown==='cover'?memory.title:shown==='contents'?'目次':page?.title??'あとがき';
 const chapter=page?chapters.findIndex(p=>p.id===page.id)+1:0;
 function turn(id:string){changed.current=true;setActive(id);}
 useEffect(()=>{if(changed.current)heading.current?.focus();},[active]);
 const pagePhotos=page?(page.visit_id?photos.filter(p=>p.visit_id===page.visit_id):book.photos.filter(p=>p.memory_page_id===page.id&&p.status==='ready')):[];
 return <section aria-label={`${memory.title}の思い出の本`} className="min-w-0 space-y-4">
  <div className="min-h-[28rem] overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm"><div className="min-h-[28rem] border-l-[10px] border-orange-200 px-5 py-8 sm:border-l-[14px] sm:px-10">
   <p className="text-xs font-semibold tracking-widest text-orange-700">{shown==='cover'?'いこポケ · 思い出の一冊':shown==='contents'?'CONTENTS':page?`CHAPTER ${String(chapter).padStart(2,'0')}`:'AFTERWORD'}</p>
   <h1 ref={heading} tabIndex={-1} className="mt-6 break-words text-3xl font-bold leading-tight tracking-tight outline-none sm:text-5xl">{title}</h1>
   {shown==='cover'?<div className="mt-8 space-y-5 border-t border-stone-200 pt-6 text-stone-600">
    {cover&&<PrivateVisitImage path={cover.object_path} contentType={cover.content_type} alt={`${memory.title}の表紙`}/>}
    <p><time dateTime={memory.memory_date}>{memory.memory_date}</time>{memory.memory_end_date&&memory.memory_end_date!==memory.memory_date&&<>〜<time dateTime={memory.memory_end_date}>{memory.memory_end_date}</time></>}</p>
    <p>訪問の記録 {visits.length}件 · 自由ページ {chapters.filter(p=>!p.visit_id).length}枚 · 写真 {photos.length}枚</p><p className="text-sm leading-7">写真と、みんなのひとこと。<br/>あの日を、少しずつ一冊に。</p><button type="button" className="kk-text-link" onClick={()=>turn('contents')}>この本をひらく →</button>
   </div>:shown==='contents'?<div className="mt-8 space-y-5">
    {chapters.length?<ol className="divide-y divide-stone-200">{chapters.map((entry,n)=>{const v=visits.find(v=>v.id===entry.visit_id);return <li key={entry.id}><button type="button" onClick={()=>turn(entry.id)} className="flex min-h-16 w-full items-center gap-4 rounded-lg py-3 text-left font-semibold hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"><span className="text-orange-700">{String(n+1).padStart(2,'0')}</span><span className="min-w-0 break-words">{entry.title}<span className="mt-1 block text-xs font-normal text-stone-500">{v?`${v.visited_on} · ${visitTimeLabel(v)}`:'写真とひとことのページ'}</span></span></button></li>;})}</ol>:<p className="text-sm leading-7 text-stone-600">まだページはありません。訪問を記録するか、待ち合わせや帰り道のページを足してみましょう。</p>}
    <InsertBookPage key="start" memory={memory} afterId={null} onAdded={turn}/><button type="button" onClick={()=>turn('afterword')} className="kk-text-link">みんなの寄せ書きへ →</button>
   </div>:page?<div className="mt-5 space-y-6">
    {page.deleting?<p role="status" className="text-sm text-stone-500">このページの削除が未完了です。下の「この自由ページを削除」から再試行できます。</p>:<>
     <BookPageEditor key={page.id+':'+page.revision} memory={memory} page={page}/>
     {visit&&<p className="text-xs leading-6 text-stone-500"><time dateTime={visit.visited_on}>{visit.visited_on}</time> · {visitTimeLabel(visit)}<span className="block">訪問先：{visit.item_title}</span></p>}
     {(visit?.note||page.body)&&<p className="whitespace-pre-wrap break-words leading-8 text-stone-700">{visit?.note||page.body}</p>}
     {pagePhotos.length?<ul className="grid gap-5 sm:grid-cols-2">{pagePhotos.map((photo,n)=><li key={photo.id}><PrivateVisitImage path={photo.object_path} contentType={photo.content_type} alt={`${page.title}の写真 ${n+1}`}/>{!page.visit_id&&<BookPhotoControls memory={memory} page={page} photo={book.photos.find(p=>p.id===photo.id)!}/>}</li>)}</ul>:<p className="text-sm text-stone-400">写真も、あとから足せます。</p>}
     {visit?<Link href={`/app/groups/${memory.group_id}/visits/${visit.id}`} className="kk-text-link text-sm">訪問メモ・写真を編集</Link>:<><BookPhotoUpload key={page.id} memory={memory} page={page}/>{book.photos.filter(p=>p.memory_page_id===page.id&&p.status!=='ready').map(photo=><BookPhotoControls key={photo.id} memory={memory} page={page} photo={photo}/>)}</>}
     <BookWords memory={memory} pageId={page.id} words={book.words}/><InsertBookPage key={page.id} memory={memory} afterId={page.id} onAdded={turn}/>
    </>}
    {!page.visit_id&&<RemoveBookPage memory={memory} page={page} onRemoved={()=>turn('contents')}/>}
   </div>:<div className="mt-8 space-y-8">
    {memory.note&&<div><p className="mb-3 text-xs font-semibold text-stone-500">この日のあとがき</p><p className="whitespace-pre-wrap break-words leading-8 text-stone-700">{memory.note}</p></div>}<a href="#memory-edit" className="kk-text-link text-sm">タイトル・あとがきを編集</a><BookWords memory={memory} pageId={null} words={book.words}/>
   </div>}
  </div></div>
  <nav aria-label="思い出のページ" className="flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={index===0} onClick={()=>turn(pages[index-1])} className="min-h-12 rounded-full border border-stone-300 bg-white px-5 font-semibold disabled:opacity-40">← 前へ</button><button type="button" onClick={()=>turn('contents')} className="kk-text-link text-sm" aria-label={`目次へ（${index+1} / ${pages.length}ページ）`}>{index+1} / {pages.length} · 目次</button><button type="button" disabled={index===pages.length-1} onClick={()=>turn(pages[index+1])} className="min-h-12 rounded-full border border-stone-300 bg-white px-5 font-semibold disabled:opacity-40">次へ →</button></nav>
  <p className="text-xs leading-6 text-stone-500">訪問は日付・時間順。自由ページは、挿入した訪問ページに続きます。みんなのペースで、あとから何度でも書き足せます。</p>
 </section>;
}
