"use client";
import Image from "next/image";
import {useEffect,useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {useNearbyImage} from "@/components/hooks/use-nearby-image";
import {PHOTO_BUCKET} from "@/lib/visits/validation";

/** Authenticated Storage downloads become local blob URLs, never public URLs. */
type ImageProps={path:string;contentType:string;alt:string;previewOnly?:boolean;load?:boolean};
export function PrivateVisitImage(props:ImageProps){
  const [attempt,setAttempt]=useState(0);
  return <PrivateImageAttempt key={JSON.stringify([props.path,props.contentType,props.load,attempt])} {...props} retry={()=>setAttempt(value=>value+1)}/>;
}
function PrivateImageAttempt({path,contentType,alt,previewOnly=false,load=true,retry}:ImageProps&{retry:()=>void}){
  const [src,setSrc]=useState<string|null>(null),[failed,setFailed]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    if(!load)return;
    let active=true,localURL:string|null=null;
    async function load(){
      try{
        const {data,error}=await createClient().storage.from(PHOTO_BUCKET).download(path);
        if(!active)return;
        if(error||!data){setFailed(true);return;}
        localURL=URL.createObjectURL(new Blob([data],{type:contentType}));setSrc(localURL);
      }catch{if(active)setFailed(true);}
    }
    void load();return ()=>{active=false;if(localURL)URL.revokeObjectURL(localURL);};
  },[path,contentType,load]);
  if(failed)return <div className="space-y-2 rounded-xl bg-stone-50 p-4"><p role="alert" className="text-sm">写真を表示できませんでした。</p>{!previewOnly&&<button type="button" onClick={retry} className="min-h-11 font-semibold text-orange-700 underline">写真を再読み込み</button>}</div>;
  if(!src)return <p role="status" className="flex h-56 items-center justify-center rounded-xl bg-stone-50 text-sm text-stone-600">写真を読み込んでいます…</p>;
  if(previewOnly)return <Image src={src} alt={alt} width={800} height={600} unoptimized onError={()=>setFailed(true)} className="h-56 w-full rounded-xl bg-stone-50 object-cover"/>;
  return <><button type="button" onClick={()=>dialog.current?.showModal()} className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"><Image src={src} alt={alt} width={800} height={600} unoptimized onError={()=>setFailed(true)} className="h-56 w-full rounded-xl bg-stone-50 object-contain"/><span className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-orange-700 underline">写真を大きく見る</span></button>
    <dialog ref={dialog} aria-label={alt} className="max-h-[95vh] max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-4 backdrop:bg-black/60"><div className="mb-3 flex justify-end"><button type="button" onClick={()=>dialog.current?.close()} className="min-h-11 rounded-full border px-5 font-semibold">閉じる</button></div><Image src={src} alt={alt} width={1600} height={1200} unoptimized className="max-h-[75vh] w-auto object-contain"/></dialog>
  </>;
}

/** Previews inside links/radio labels stay non-interactive and download nearby images only. */
export function PrivatePhotoPreview(props:{path:string;contentType:string;alt:string}){
  const {ref,visible}=useNearbyImage<HTMLDivElement>("200px");
  return <div ref={ref}><PrivateVisitImage {...props} previewOnly load={visible}/></div>;
}
