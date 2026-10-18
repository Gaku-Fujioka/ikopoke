"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import {cancelPhotoAction,finishPhotoAction,reservePhotoAction} from "@/app/app/groups/[groupId]/visits/actions";
import {PHOTO_BUCKET,PHOTO_TYPES,PHOTO_LIMIT,photoFileInput} from "@/lib/visits/validation";
import {PhotoTransferError,transferVisitPhoto} from "@/lib/visits/photo-transfer";
type QueuedPhoto={id:string;file:File;done:boolean};
function photoForm(groupId:string,visitId:string,photoId:string){const form=new FormData();form.set("groupId",groupId);form.set("visitId",visitId);form.set("photoId",photoId);return form;}
export function PhotoUpload({groupId,visitId}:{groupId:string;visitId:string}){
  const [queue,setQueue]=useState<QueuedPhoto[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[success,setSuccess]=useState("");
  const router=useRouter();
  async function upload(event:React.FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError(null);setSuccess("");
    try{
      const client=createClient();
      for(const entry of queue.filter(entry=>!entry.done)){
        const input=photoFileInput(entry.file.type,entry.file.size),form=photoForm(groupId,visitId,entry.id);
        form.set("contentType",input.contentType);form.set("byteSize",String(input.byteSize));
        await transferVisitPhoto({reserve:()=>reservePhotoAction(form),upload:path=>client.storage.from(PHOTO_BUCKET).upload(path,entry.file,{contentType:input.contentType,upsert:false,cacheControl:"0"}),finish:()=>finishPhotoAction(form)});
        setQueue(current=>current.map(row=>row.id===entry.id?{...row,done:true}:row));
      }
      setSuccess("写真を保存しました。");
    }catch(cause){setError(cause instanceof PhotoTransferError?cause.message:"写真を追加できませんでした。通信状態を確認して、もう一度お試しください。");}
    finally{setBusy(false);router.refresh();}
  }
  return <form onSubmit={upload} aria-busy={busy} className="space-y-3 border-t border-stone-200 pt-5">
    <label className="block space-y-2 font-semibold"><span>写真を追加</span><input type="file" accept={PHOTO_TYPES.join(",")} multiple disabled={busy} onChange={event=>{
      setError(null);setSuccess("");const files=Array.from(event.target.files??[]);
      try{if(files.length>PHOTO_LIMIT)throw new Error("一度に選ぶ写真は10枚までです。");for(const file of files)photoFileInput(file.type,file.size);setQueue(files.map(file=>({id:crypto.randomUUID(),file,done:false})));}
      catch(cause){setQueue([]);setError(cause instanceof Error?cause.message:"写真を選び直してください。");event.target.value="";}
    }} className="block min-h-11 w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-full file:border file:border-stone-300 file:bg-white file:px-4"/></label>
    <p className="text-xs leading-5 text-stone-500">1訪問10枚まで、1枚10MB以内。JPEG・PNG・WebPに対応。写真なしでも訪問記録は残ります。</p>
    {queue.length>0&&<ul className="space-y-1 text-sm text-stone-600">{queue.map(entry=><li key={entry.id} className="break-all">{entry.file.name}：{entry.done?"保存済み":"未完了"}</li>)}</ul>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{success&&<p role="status" className="text-sm text-stone-600">{success}</p>}
    <button disabled={busy||!queue.some(entry=>!entry.done)} className="min-h-12 rounded-full bg-orange-700 px-6 font-semibold text-white disabled:opacity-50">{busy?"写真を送信しています…":"写真を保存・再試行"}</button>
  </form>;
}
export function PendingPhoto({groupId,visitId,photoId,cancelling}:{groupId:string;visitId:string;photoId:string;cancelling:boolean}){
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);const router=useRouter();
  async function run(cancel:boolean){
    if(busy)return;setBusy(true);setError(null);
    try{const result=await (cancel?cancelPhotoAction:finishPhotoAction)(photoForm(groupId,visitId,photoId));if(result.error)setError(result.error);}
    catch{setError("通信を確認して、もう一度お試しください。");}
    finally{setBusy(false);router.refresh();}
  }
  return <li className="space-y-2 rounded-xl border border-stone-200 p-4"><p className="text-sm text-stone-600">{cancelling?"中断処理が未完了の写真があります。":"送信が未完了の写真があります。送信済みなら確認するか、中断して選び直せます。"}</p><div className="flex flex-wrap gap-3">{!cancelling&&<button type="button" disabled={busy} onClick={()=>run(false)} className="min-h-11 font-semibold text-orange-700 underline">送信済みか確認</button>}<button type="button" disabled={busy} onClick={()=>run(true)} className="min-h-11 font-semibold text-red-700 underline">{cancelling?"中断を再試行":"未完了の送信を中断"}</button></div>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}</li>;
}
