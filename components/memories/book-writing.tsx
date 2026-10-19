"use client";
import {useActionState,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {saveBookAction,openBookAction,bookPhotoAction,type BookState} from '@/app/app/groups/[groupId]/memories/book-actions';
import type {SavedMemory} from '@/lib/memories/repository';
import type {BookPage,BookWord,BookPhoto} from '@/lib/memories/book';
import {createClient} from '@/lib/supabase/client';
import {PHOTO_BUCKET,PHOTO_TYPES,photoFileInput} from '@/lib/visits/validation';
import {transferVisitPhoto,PhotoTransferError} from '@/lib/visits/photo-transfer';

const button='kk-primary-link disabled:opacity-50';
const field='min-h-12 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700';
function Context({memory,id='',pageId='',revision=0}:{memory:SavedMemory;id?:string;pageId?:string;revision?:number}){
 return <><input type="hidden" name="groupId" value={memory.group_id}/><input type="hidden" name="memoryId" value={memory.id}/><input type="hidden" name="id" value={id}/><input type="hidden" name="pageId" value={pageId}/><input type="hidden" name="revision" value={revision}/></>;
}
function Result({state}:{state:BookState}){return <>{state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.saved&&<p role="status" className="text-sm text-stone-600">保存しました。</p>}</>;}
function WordForm({memory,pageId,word}:{memory:SavedMemory;pageId:string|null;word?:BookWord}){
 const [body,setBody]=useState(word?.body??''),request=useRef<string|null>(null),router=useRouter();
 const [state,action,pending]=useActionState(async(previous:BookState,form:FormData)=>{
  if(!word){request.current??=crypto.randomUUID();form.set('id',request.current);}
  const result=await saveBookAction(previous,form);
  if(result.saved){if(!word){setBody('');request.current=null;}router.refresh();}
  return result;
 },{error:null});
 if(state.removed)return <p role="status" className="text-sm text-stone-500">ひとことを削除しました。</p>;
 return <form action={action} aria-busy={pending} className="space-y-3"><Context memory={memory} id={word?.id} pageId={pageId??''} revision={state.revision??word?.revision??0}/>
  <label className="block space-y-2"><span className="text-sm font-semibold">{word?'自分の言葉を編集':pageId?'このページにひとこと':'今日の思い出を、ひとこと'}</span><textarea name="body" value={body} onChange={e=>setBody(e.target.value)} rows={2} disabled={pending} className={field} placeholder={pageId?'覚えておきたいこと、写真の裏話など':'楽しかったことや、みんなへの言葉など'}/></label>
  <p className="text-xs text-stone-500">500文字以内。あとから書き直せます。</p><Result state={state}/>
  <button name="operation" value="save_word" disabled={pending||!body.trim()} className={button}>{pending?'保存中…':word?'書き直す':'ひとことを残す'}</button>
  {word&&<details className="text-sm"><summary className="min-h-11 cursor-pointer py-3 text-stone-500">このひとことを削除</summary><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="confirm" value="delete" disabled={pending}/>このひとことを削除する</label><button name="operation" value="delete_word" className="kk-text-link text-red-700" disabled={pending}>削除する</button></details>}
 </form>;
}
export function BookWords({memory,pageId,words}:{memory:SavedMemory;pageId:string|null;words:BookWord[]}){
 const entries=words.filter(w=>w.page_id===pageId);
 return <section className="space-y-5 border-t border-stone-200 pt-6" aria-label={pageId?'このページへのひとこと':'みんなの寄せ書き'}><div><h2 className="text-xl font-bold">{pageId?'このページへのひとこと':'みんなの寄せ書き'}</h2><p className="mt-2 text-sm leading-6 text-stone-500">{pageId?'同じ場面も、それぞれの思い出。':'ひとことずつ、あの日の一冊に。書けるときに、気軽にどうぞ。'}</p></div>
  {entries.length?<ul className="space-y-4">{entries.map(w=><li key={w.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{w.author_name}{w.is_mine?'（あなた）':''}</strong><time className="text-xs text-stone-400" dateTime={w.created_at}>{new Date(w.created_at).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'})}</time></div><p className="whitespace-pre-wrap break-words leading-7">{w.body}</p>{w.is_mine&&<details className="mt-2"><summary className="kk-text-link cursor-pointer text-sm">自分のひとことを編集</summary><div className="mt-3"><WordForm key={w.id+':'+w.revision} memory={memory} pageId={pageId} word={w}/></div></details>}</li>)}</ul>:<p className="text-sm text-stone-500">まだひとことはありません。最初の思い出を残してみましょう。</p>}
  <WordForm key={pageId??'guestbook'} memory={memory} pageId={pageId}/>
 </section>;
}
export function BookPageEditor({memory,page}:{memory:SavedMemory;page:BookPage}){
 const [title,setTitle]=useState(page.title),[body,setBody]=useState(page.body),router=useRouter();
 const [state,action,pending]=useActionState(async(previous:BookState,form:FormData)=>{const result=await saveBookAction(previous,form);if(result.saved)router.refresh();return result;},{error:null});
 return <details><summary className="kk-text-link cursor-pointer text-sm">{page.visit_id?'章の名前を編集':'章の名前・本文を編集'}</summary><form action={action} className="mt-3 space-y-3" aria-busy={pending}><Context memory={memory} id={page.id} revision={state.revision??page.revision}/><input type="hidden" name="operation" value="edit_page"/><input type="hidden" name="freePage" value={String(!page.visit_id)}/>
  <label className="block space-y-2 text-sm font-semibold"><span>章の名前（120文字以内）</span><input name="title" value={title} onChange={e=>setTitle(e.target.value)} disabled={pending} required={!page.visit_id} className={field}/></label>
  {page.visit_id?<><input type="hidden" name="body" value=""/><p className="text-xs leading-6 text-stone-500">この本での名前を変更します。空欄で保存すると、元の訪問先の名前に戻ります。</p></>:<label className="block space-y-2 text-sm font-semibold"><span>このページのメモ（任意・2000文字以内）</span><textarea name="body" value={body} onChange={e=>setBody(e.target.value)} rows={3} disabled={pending} className={field}/></label>}
  <p className="text-xs text-stone-500">グループのみんなに反映されます。</p><Result state={state}/><button disabled={pending} className={button}>{pending?'保存中…':'保存する'}</button>
 </form></details>;
}
export function InsertBookPage({memory,afterId,onAdded}:{memory:SavedMemory;afterId:string|null;onAdded:(id:string)=>void}){
 const request=useRef<string|null>(null),formRef=useRef<HTMLFormElement>(null),router=useRouter();
 const [state,action,pending]=useActionState(async(previous:BookState,form:FormData)=>{request.current??=crypto.randomUUID();form.set('id',request.current);const result=await saveBookAction(previous,form);if(result.saved&&result.pageId){request.current=null;formRef.current?.reset();onAdded(result.pageId);router.refresh();}return result;},{error:null});
 return <details className="rounded-2xl border border-dashed border-stone-300 p-4"><summary className="kk-text-link cursor-pointer text-sm">＋ {afterId?'このあとにページを足す':'最初にページを足す'}</summary><form ref={formRef} action={action} aria-busy={pending} className="mt-4 space-y-3"><Context memory={memory} pageId={afterId??''}/><input type="hidden" name="operation" value="add_page"/><p className="text-sm leading-6 text-stone-500">待ち合わせや帰り道のことも。この本だけのページを足せます。</p><label className="block space-y-2 text-sm font-semibold"><span>章の名前（必須・120文字以内）</span><input name="title" required disabled={pending} className={field} placeholder="帰り道、アイスを食べながら"/></label><label className="block space-y-2 text-sm font-semibold"><span>メモ（任意・2000文字以内）</span><textarea name="body" rows={3} disabled={pending} className={field}/></label><p className="text-xs text-stone-500">写真はページを足してから選べます。写真なしでも残せます。</p><Result state={state}/><button disabled={pending} className={button}>{pending?'追加中…':'ページを足す'}</button></form></details>;
}
function photoForm(memory:SavedMemory,page:BookPage,id:string,operation:string){const f=new FormData();Object.entries({groupId:memory.group_id,memoryId:memory.id,pageId:page.id,id,revision:String(page.revision),operation}).forEach(([k,v])=>f.set(k,v));return f;}
export function BookPhotoUpload({memory,page}:{memory:SavedMemory;page:BookPage}){
 const [queue,setQueue]=useState<{id:string;file:File;done:boolean}[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState<BookState>({error:null}),router=useRouter();
 async function upload(e:React.FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setMessage({error:null});
  try{const client=createClient();for(const entry of queue.filter(q=>!q.done)){
   const input=photoFileInput(entry.file.type,entry.file.size),f=photoForm(memory,page,entry.id,'reserve_photo');f.set('contentType',input.contentType);f.set('byteSize',String(input.byteSize));
   await transferVisitPhoto({reserve:()=>bookPhotoAction(f),upload:path=>client.storage.from(PHOTO_BUCKET).upload(path,entry.file,{contentType:input.contentType,upsert:false,cacheControl:'0'}),finish:()=>{const done=photoForm(memory,page,entry.id,'finish_photo');return bookPhotoAction(done);}});
   setQueue(current=>current.map(q=>q.id===entry.id?{...q,done:true}:q));
  }setMessage({error:null,saved:true});}catch(error){setMessage({error:error instanceof PhotoTransferError?error.message:'写真を送信できませんでした。再試行してください。'});}finally{setBusy(false);router.refresh();}
 }
 return <details className="border-t border-stone-200 pt-3"><summary className="kk-text-link cursor-pointer text-sm">写真を追加</summary><form onSubmit={upload} className="mt-3 space-y-3" aria-busy={busy}><label className="block space-y-2 text-sm"><span>このページの写真</span><input type="file" multiple accept={PHOTO_TYPES.join(',')} disabled={busy} className="block min-h-11 w-full min-w-0 text-sm" onChange={e=>{try{const files=Array.from(e.target.files??[]);if(files.length>10)throw new Error('一度に選ぶ写真は10枚までです。');files.forEach(f=>photoFileInput(f.type,f.size));setQueue(files.map(file=>({id:crypto.randomUUID(),file,done:false})));setMessage({error:null});}catch(error){setQueue([]);e.target.value='';setMessage({error:error instanceof Error?error.message:'写真を選び直してください。'});}}}/></label><p className="text-xs leading-6 text-stone-500">1ページ10枚、1枚10MBまで。JPEG・PNG・WebPに対応。</p>{queue.map(q=><p key={q.id} className="break-all text-xs">{q.file.name}：{q.done?'保存済み':'未完了'}</p>)}<Result state={message}/><button disabled={busy||!queue.some(q=>!q.done)} className={button}>{busy?'送信中…':'写真を保存・再試行'}</button></form></details>;
}
export function BookPhotoControls({memory,page,photo}:{memory:SavedMemory;page:BookPage;photo:BookPhoto}){
 const [state,setState]=useState<BookState>({error:null}),[busy,setBusy]=useState(false),router=useRouter();
 async function run(operation:string){if(busy)return;setBusy(true);const f=photoForm(memory,page,photo.id,operation);f.set('confirm','delete');try{setState(await bookPhotoAction(f));}catch{setState({error:'通信状態を確認して再試行してください。'});}finally{setBusy(false);router.refresh();}}
 return <div className="mt-2 space-y-2">{photo.status!=='ready'&&<><p className="text-sm text-stone-500">{photo.status==='cancelling'?'写真の削除が未完了です。':'写真の送信が未完了です。'}</p>{photo.status==='pending'&&<button className="kk-text-link text-sm" disabled={busy} onClick={()=>run('finish_photo')}>送信済みか確認</button>}</>}{photo.can_delete&&<details><summary className="kk-text-link cursor-pointer text-sm">{photo.status==='ready'?'写真を削除':'未完了の送信を中断'}</summary><p className="my-2 text-xs text-stone-500">この写真を削除します。表紙に使っている場合は、表紙の選択も解除されます。</p><button className="kk-text-link text-sm text-red-700" disabled={busy} onClick={()=>run('remove_photo')}>{busy?'処理中…':'確認して削除する'}</button></details>}<Result state={state}/></div>;
}
export function RemoveBookPage({memory,page,onRemoved}:{memory:SavedMemory;page:BookPage;onRemoved:()=>void}){
 const [state,setState]=useState<BookState>({error:null}),[busy,setBusy]=useState(false),router=useRouter();
 async function remove(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);const f=photoForm(memory,page,page.id,'remove_page');f.set('confirm','delete');try{const result=await bookPhotoAction(f);setState(result);if(result.removed)onRemoved();}catch{setState({error:'削除が未完了です。再試行してください。'});}finally{setBusy(false);router.refresh();}}
 if(!page.can_delete)return null;
 return <details><summary className="kk-text-link cursor-pointer text-sm text-stone-500">この自由ページを削除</summary><form onSubmit={remove} className="mt-3 space-y-3"><p className="text-sm leading-6">このページの写真と、みんなが書いたひとことも削除します。</p><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" required disabled={busy}/>写真・ひとことを含めて削除する</label><Result state={state}/><button disabled={busy} className="kk-text-link text-sm text-red-700">{busy?'削除中…':page.deleting?'削除を再試行する':'ページを削除する'}</button></form></details>;
}
export function OpenBookForm({groupId,outingId}:{groupId:string;outingId:string}){
 const [state,action,pending]=useActionState(openBookAction,{error:null});
 return <form action={action} aria-busy={pending} className="kk-surface space-y-3"><input type="hidden" name="groupId" value={groupId}/><input type="hidden" name="outingId" value={outingId}/><div><p className="font-bold">今日の思い出、少しずつ。</p><p className="mt-2 text-sm leading-6 text-stone-600">おでかけ中から、写真やひとことを書き足せます。あとで終了しても同じ一冊に残ります。</p></div><Result state={state}/><button disabled={pending} className="kk-text-link">{pending?'本を開いています…':'思い出の本を開く →'}</button></form>;
}
