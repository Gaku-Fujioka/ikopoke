"use client";
import Image from "next/image";
import {useEffect,useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {PHOTO_BUCKET} from "@/lib/visits/validation";

/** Authenticated Storage downloads become local blob URLs, never public URLs. */
export function PrivateVisitImage({path,contentType,alt}:{path:string;contentType:string;alt:string}){
  const [src,setSrc]=useState<string|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    let active=true,localURL:string|null=null;setSrc(null);setFailed(false);
    async function load(){
      try{
        const {data,error}=await createClient().storage.from(PHOTO_BUCKET).download(path);
        if(!active)return;
        if(error||!data){setFailed(true);return;}
        localURL=URL.createObjectURL(new Blob([data],{type:contentType}));setSrc(localURL);
      }catch{if(active)setFailed(true);}
    }
    void load();return ()=>{active=false;if(localURL)URL.revokeObjectURL(localURL);};
  },[path,contentType,attempt]);
  if(failed)return <div className="space-y-2 rounded-xl bg-stone-50 p-4"><p role="alert" className="text-sm">写真を表示できませんでした。</p><button type="button" onClick={()=>setAttempt(value=>value+1)} className="min-h-11 font-semibold text-orange-700 underline">写真を再読み込み</button></div>;
  if(!src)return <p role="status" className="flex h-56 items-center justify-center rounded-xl bg-stone-50 text-sm text-stone-600">写真を読み込んでいます…</p>;
  return <><button type="button" onClick={()=>dialog.current?.showModal()} className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"><Image src={src} alt={alt} width={800} height={600} unoptimized onError={()=>setFailed(true)} className="h-56 w-full rounded-xl bg-stone-50 object-contain"/><span className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-orange-700 underline">写真を大きく見る</span></button>
    <dialog ref={dialog} aria-label={alt} className="max-h-[95vh] max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-4 backdrop:bg-black/60"><form method="dialog" className="mb-3 flex justify-end"><button className="min-h-11 rounded-full border px-5 font-semibold">閉じる</button></form><Image src={src} alt={alt} width={1600} height={1200} unoptimized className="max-h-[75vh] w-auto object-contain"/></dialog>
  </>;
}
