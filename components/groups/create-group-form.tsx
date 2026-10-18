"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import { createGroupProfileAction } from "@/app/app/groups/actions";
import {profileMediaAction} from "@/app/app/profile/presentation-actions";
import {completeGroupCreation,type NewGroupResult} from "@/lib/groups/creation";
import {normalizePhoto,publishPhoto,type PhotoRequest} from "@/lib/presentation/photo";
import {createClient} from "@/lib/supabase/client";

export function CreateGroupForm({ requestId }: { requestId: string }) {
  const router=useRouter(),[stableRequestId]=useState(requestId);
  const [photo,setPhoto]=useState<File|null>(null),upload=useRef<PhotoRequest|null>(null),inFlight=useRef(false);
  const photoInput=useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(async(previous:NewGroupResult,form:FormData):Promise<NewGroupResult>=>{
    if(inFlight.current)return previous;inFlight.current=true;
    try {
      // Validate/resize before creating anything. Keep the same photo UUID on retries.
      if(photo&&!upload.current){
        try{upload.current={id:crypto.randomUUID(),file:await normalizePhoto(photo),expected:null};}
        catch{return {error:"写真を準備できませんでした。JPEG・PNG・WebPの10MB以内の画像でお試しください。",groupId:previous.groupId};}
      }
      const result=await completeGroupCreation(form,previous.groupId,createGroupProfileAction,upload.current?async groupId=>{
        await publishPhoto({...upload.current!,groupId},profileMediaAction,(path,file)=>createClient().storage.from("visit-photos").upload(path,file,{contentType:"image/jpeg",upsert:false,cacheControl:"0"}));
      }:undefined);
      if(!result.error&&result.groupId){router.push(`/app/groups/${result.groupId}`);router.refresh();}
      return result;
    }catch{return {error:"通信を確認して、もう一度お試しください。同じ画面から再試行できます。",groupId:previous.groupId};}
    finally{inFlight.current=false;}
  }, { error: null });
  const [name, setName] = useState("");
  const [description,setDescription]=useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (state.fieldError) nameRef.current?.focus(); }, [state]);

  return (
    <section aria-labelledby="create-group-title" className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <h2 id="create-group-title" className="text-xl font-semibold">新しいグループを作る</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">名前だけでも始められます。写真や説明は、あとからみんなで変更できます。</p>
      <form action={action} aria-busy={pending} className="mt-5 space-y-4">
        <input type="hidden" name="requestId" value={stableRequestId} />
        <div className="space-y-2">
          <label htmlFor="group-name" className="block text-sm font-semibold">グループの名前 <span className="text-orange-700">必須</span></label>
          <input ref={nameRef} id="group-name" name="name" required value={name} onChange={(event) => setName(event.target.value)} disabled={pending||!!state.groupId} aria-describedby={state.error ? "group-name-help group-error" : "group-name-help"} aria-invalid={state.fieldError ?? false} className="min-h-12 w-full rounded-xl border border-stone-300 px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:opacity-60" placeholder="例：週末のおでかけ" />
          <p id="group-name-help" className="text-xs leading-5 text-stone-500">80文字以内で入力してください。</p>
        </div>
        <div className="space-y-2"><label htmlFor="group-description" className="block text-sm font-semibold">グループの説明 <span className="font-normal text-stone-500">任意</span></label><textarea id="group-description" name="description" value={description} onChange={event=>setDescription(event.target.value)} maxLength={500} rows={3} disabled={pending||!!state.groupId} className="kk-field" placeholder="どんな仲間？ どんな場所に行きたい？" aria-describedby="group-description-help"/><p id="group-description-help" className="text-xs leading-5 text-stone-500">500文字まで。有効な招待を持つ人にも、ログイン後・参加前に表示します。</p></div>
        <div className="space-y-2"><label htmlFor="group-photo" className="block text-sm font-semibold">グループの写真 <span className="font-normal text-stone-500">任意</span></label><input ref={photoInput} id="group-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending||!!state.groupId} onChange={event=>{setPhoto(event.target.files?.[0]??null);upload.current=null;}} className="block min-h-11 w-full text-sm" aria-describedby="group-photo-help"/>{photo&&<p className="break-words text-sm text-stone-600">選択済み：{photo.name}</p>}<p id="group-photo-help" className="text-xs leading-5 text-stone-500">JPEG・PNG・WebP、10MBまで。ホームのカードにも表示します。保存用に圧縮します。</p>{photo&&!state.groupId&&<button type="button" disabled={pending} onClick={()=>{setPhoto(null);upload.current=null;if(photoInput.current)photoInput.current.value="";}} className="kk-text-link">写真を使わない</button>}</div>
        {state.error && <p id="group-error" role="alert" className="text-sm font-medium text-red-700">{state.error}</p>}
        <div className="flex flex-wrap items-center gap-4"><button type="submit" disabled={pending} className="min-h-12 rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{pending ? "保存中…" :state.groupId?"写真の保存を再試行": "グループを作成"}</button>{state.groupId&&<Link href={`/app/groups/${state.groupId}`} className="kk-text-link">写真は後から設定して開く →</Link>}</div>
      </form>
    </section>
  );
}
