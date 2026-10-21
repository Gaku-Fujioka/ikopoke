"use client";
import Image from "next/image";
import {useEffect,useState} from "react";
import {Camera,X} from "lucide-react";
import {PHOTO_TYPES} from "@/lib/visits/validation";
import {selectVisitPhotos,type SelectedVisitPhoto} from "@/lib/visits/creation";

function LocalPreview({file}:{file:File}){
  const [url,setUrl]=useState<string>();
  useEffect(()=>{const src=URL.createObjectURL(file);setUrl(src);return()=>URL.revokeObjectURL(src);},[file]);
  return url?<Image src={url} alt="選択した写真" width={240} height={240} unoptimized className="aspect-square w-full rounded-xl object-cover"/>:<div className="aspect-square rounded-xl bg-stone-100"/>;
}
export function VisitPhotoPicker({photos,onChange,disabled}:{photos:SelectedVisitPhoto[];onChange:(photos:SelectedVisitPhoto[])=>void;disabled:boolean}){
  const [error,setError]=useState<string|null>(null);
  return <section className="space-y-3" aria-label="訪問の写真">
    <label className="block space-y-2 font-semibold"><span className="flex items-center gap-2"><Camera size={20} aria-hidden="true"/>写真（任意）<span className="text-sm font-normal">{photos.length} / 10枚</span></span>
      <input type="file" multiple accept={PHOTO_TYPES.join(",")} disabled={disabled} onChange={event=>{
        const files=Array.from(event.target.files??[]);setError(null);
        try{onChange(selectVisitPhotos(photos,files));}catch(cause){setError(cause instanceof Error?cause.message:"写真を選び直してください。");}
        event.target.value="";
      }} className="block min-h-11 w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-full file:border file:border-stone-300 file:bg-white file:px-4"/>
    </label>
    <p className="text-xs leading-5 text-stone-600">写真もメモと一緒に保存できます。1枚10MB以内のJPEG・PNG・WebP。グループで共有します。</p>
    {photos.length>0&&<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo,index)=><li key={photo.id} className="min-w-0 space-y-1"><LocalPreview file={photo.file}/><p className="truncate text-xs">{photo.file.name}</p><div className="flex items-center justify-between gap-1"><span className="text-xs text-stone-600">{photo.done?"保存済み":`写真 ${index+1}`}</span><button type="button" disabled={disabled} onClick={()=>onChange(photos.filter(row=>row.id!==photo.id))} aria-label={`写真 ${index+1}を外す`} className="inline-flex min-h-11 items-center gap-1 text-xs underline disabled:opacity-40"><X size={14} aria-hidden="true"/>外す</button></div></li>)}</ul>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
