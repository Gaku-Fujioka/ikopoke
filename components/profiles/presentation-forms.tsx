"use client";
import {useActionState,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import {GROUP_COLORS,type GroupColor} from "@/lib/presentation/colors";
import type {GroupPresentation,MediaEditor} from "@/lib/presentation/repository";
import {profileMediaAction,saveGroupPresentationAction,type PresentationState} from "@/app/app/profile/presentation-actions";
import {ProfileImage} from "./profile-image";

export function GroupPresentationForm({groupId,presentation}:{groupId:string;presentation:GroupPresentation}){
 const [color,setColor]=useState<GroupColor>(presentation.color??"sky");
 const [colorState,colorAction,colorPending]=useActionState(saveGroupPresentationAction,{error:null});
 const [descriptionDraft,setDescriptionDraft]=useState<{body:string;revision:number}|null>(null);
 // Keep the text and its expected revision together across unrelated photo/color refreshes.
 const [aboutState,aboutAction,aboutPending]=useActionState(async(previous:PresentationState,form:FormData)=>{
  const result=await saveGroupPresentationAction(previous,form);
  if(result.saved)setDescriptionDraft(null);
  return result;
 },{error:null});
 return <div className="space-y-6">
  <section className="kk-surface space-y-4"><div><h2 className="text-xl font-bold">自分の表示色</h2><p className="mt-2 text-sm text-stone-600">あなたの画面だけの色です。他のメンバーの色は変わりません。</p></div>
   <form action={colorAction} className="space-y-4" aria-busy={colorPending}><input type="hidden" name="groupId" value={groupId}/><input type="hidden" name="mode" value="color"/>
    <fieldset disabled={colorPending} className="kk-color-choices"><legend className="sr-only">表示色</legend>{Object.entries(GROUP_COLORS).map(([key,value])=><label key={key}><input type="radio" name="color" value={key} checked={color===key} onChange={()=>setColor(key as GroupColor)}/><span style={{background:value.fill,borderColor:value.mark}} aria-hidden="true"/>{value.label}</label>)}</fieldset>
    <button disabled={colorPending} className="kk-primary-link">{colorPending?"保存中…":"自分の色を保存"}</button>{colorState.error&&<p role="alert" className="text-sm text-red-700">{colorState.error}</p>}{colorState.saved&&<p role="status" className="text-sm">表示色を保存しました。</p>}
   </form>
  </section>
  <section className="kk-surface space-y-4"><div><h2 className="text-xl font-bold">このグループについて</h2><p className="mt-2 text-sm text-stone-600">写真・説明はみんなで共有します。有効な招待を持つ人にも、ログイン後・参加前に表示します。</p></div>
   <form action={aboutAction} className="space-y-4" aria-busy={aboutPending}><input type="hidden" name="groupId" value={groupId}/><input type="hidden" name="mode" value="description"/><input type="hidden" name="revision" value={descriptionDraft?.revision??presentation.revision}/>
    <label className="block space-y-2"><span className="font-semibold">グループの説明 <small className="font-normal text-stone-500">任意・500文字まで</small></span><textarea name="description" value={descriptionDraft?.body??presentation.description} onChange={event=>{const body=event.target.value;setDescriptionDraft(current=>({body,revision:current?.revision??presentation.revision}));}} disabled={aboutPending} maxLength={500} rows={4} className="kk-field"/></label>
    <button disabled={aboutPending} className="kk-primary-link">{aboutPending?"保存中…":"説明を保存"}</button>{aboutState.error&&<p role="alert" className="text-sm text-red-700">{aboutState.error}</p>}{aboutState.saved&&<p role="status" className="text-sm">説明を保存しました。</p>}
   </form>
  </section>
 </div>;
}

async function normalizePhoto(file:File):Promise<Blob>{
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024)throw new Error("JPEG・PNG・WebPの10MB以内の写真を選んでください。");
 const bitmap=await createImageBitmap(file);try{
  if(bitmap.width*bitmap.height>40000000)throw new Error("写真が大きすぎます。小さくしてから選んでください。");
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext("2d");if(!context)throw new Error("写真を変換できませんでした。");context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const image=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("写真を変換できませんでした。")),"image/jpeg",.82));
  if(image.size>2097152)throw new Error("写真を2MB以内に変換できませんでした。小さい写真を選んでください。");return image;
 }finally{bitmap.close();}
}
export function ProfilePhotoEditor({groupId,editor}:{groupId?:string;editor:MediaEditor}){
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState("");
 const [selected,setSelected]=useState<File|null>(null),[reservation,setReservation]=useState<{id:string;file:Blob;expected:string|null}|null>(null);
 const inFlight=useRef(false),router=useRouter();
 const kind=groupId?"cover":"avatar";
 function form(operation:string,id?:string,expected=editor.id,size?:number){const f=new FormData();f.set("operation",operation);f.set("kind",kind);if(groupId)f.set("groupId",groupId);if(id)f.set("mediaId",id);if(expected)f.set("expectedId",expected);if(size)f.set("byteSize",String(size));return f;}
 async function action(operation:string,id?:string,expected=editor.id,size?:number){const result=await profileMediaAction(form(operation,id,expected,size));if(result.error)throw new Error(result.error);return result;}
 async function discard(id:string){const result=await action("discard",id);if(!result.path)return;const removed=await createClient().storage.from("visit-photos").remove([result.path]);if(removed.error)throw new Error("写真の整理が未完了です。もう一度お試しください。");await action("forget",id);}
 async function run(work:()=>Promise<void|string>){if(inFlight.current)return;inFlight.current=true;setBusy(true);setError(null);setMessage("");try{const result=await work();setMessage(result??"写真の設定を更新しました。");}catch(cause){setError(cause instanceof Error?cause.message:"写真を更新できませんでした。");}finally{inFlight.current=false;setBusy(false);router.refresh();}}
 async function save(){await run(async()=>{
  const pending=reservation??(selected?{id:crypto.randomUUID(),file:await normalizePhoto(selected),expected:editor.id}:null);if(!pending)throw new Error("写真を選んでください。");setReservation(pending);
  const reserved=await action("reserve",pending.id,pending.expected,pending.file.size);if(!reserved.path)throw new Error("写真を送信できませんでした。");
  // A lost upload response may still mean success. The DB independently verifies bytes/metadata.
  try{await createClient().storage.from("visit-photos").upload(reserved.path,pending.file,{contentType:"image/jpeg",upsert:false,cacheControl:"0"});}catch{}
  await action("publish",pending.id);setReservation(null);setSelected(null);
  if(pending.expected)try{await discard(pending.expected);}catch{return "写真を保存しました。古い写真は未使用の写真から整理できます。";}
 });}
 return <section className="kk-surface space-y-4" aria-busy={busy}><div><h2 className="text-xl font-bold">{groupId?"グループの写真":"あなたの写真"}</h2><p className="mt-2 text-sm text-stone-600">{groupId?"ホームのグループカードにも表示します。":"参加しているすべてのグループで同じ写真を使います。"}</p></div>
  <ProfileImage path={editor.path} alt={groupId?"グループの写真":"あなたのプロフィール写真"} fallback={groupId?"写真なし":"写真は未設定"} className={groupId?"kk-cover-preview":"kk-avatar-preview"}/>
  <label className="block space-y-2"><span className="font-semibold">写真を選ぶ <small className="text-stone-500">任意</small></span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||!!reservation} onChange={event=>{setSelected(event.target.files?.[0]??null);setError(null);}} className="block min-h-11 w-full text-sm"/></label>
  <p className="text-xs text-stone-500">JPEG・PNG・WebP、10MBまで。保存用に圧縮し、中央を切り取って表示します。</p>
  <div className="flex flex-wrap gap-3"><button type="button" disabled={busy||(!selected&&!reservation)} onClick={()=>void save()} className="kk-primary-link">{busy?"処理中…":reservation?"写真の保存を再試行":"写真を保存"}</button>
   {reservation&&<button type="button" disabled={busy} onClick={()=>void run(async()=>{await discard(reservation.id);setReservation(null);setSelected(null);})} className="kk-text-link">未完了の送信を取り消す</button>}
   {editor.id&&<button type="button" disabled={busy||!!reservation} onClick={()=>void run(async()=>{await action("detach");await discard(editor.id!);})} className="kk-text-link">写真を解除</button>}
  </div>
  {editor.unused.length>0&&<details className="border-t pt-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">未使用・未完了の写真（{editor.unused.length}件）</summary><ul className="space-y-3">{editor.unused.map((entry,index)=><li key={entry.id} className="flex flex-wrap items-center gap-3 border-t pt-3 text-sm"><span>写真 {index+1} · {entry.status==="pending"?"未完了":"未使用"}</span>{entry.can_publish&&<button type="button" disabled={busy} onClick={()=>void run(async()=>{await action("publish",entry.id);})} className="kk-text-link">保存済みか確認</button>}<button type="button" disabled={busy} onClick={()=>void run(async()=>{await discard(entry.id);})} className="kk-text-link">取り消し・整理</button></li>)}</ul></details>}
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{message&&<p role="status" className="text-sm">{message}</p>}
 </section>;
}
