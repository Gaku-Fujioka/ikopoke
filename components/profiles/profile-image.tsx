"use client";
import Image from "next/image";
import {useEffect,useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {isProfilePath} from "@/lib/presentation/colors";

/** No public/signed URL: each visible image download rechecks current Storage RLS. */
export function ProfileImage({path,alt,fallback="",className=""}:{path?:string|null;alt:string;fallback?:string;className?:string}){
 const root=useRef<HTMLSpanElement>(null),[visible,setVisible]=useState(false),[src,setSrc]=useState<string|null>(null);
 useEffect(()=>{const node=root.current;if(!node)return;if(!globalThis.IntersectionObserver){setVisible(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:"160px"});observer.observe(node);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  setSrc(null);if(!visible||!isProfilePath(path))return;let active=true,local:string|null=null;
  void (async()=>{try{const {data,error}=await createClient().storage.from("visit-photos").download(path);if(!active||error||!data)return;local=URL.createObjectURL(new Blob([data],{type:"image/jpeg"}));setSrc(local);}catch{/* Text/neutral placeholder remains usable. */}})();
  return()=>{active=false;if(local)URL.revokeObjectURL(local);};
 },[path,visible]);
 return <span ref={root} aria-hidden={alt?undefined:true} className={`kk-profile-image ${className}`}>{src?<Image src={src} alt={alt} fill sizes="(max-width: 640px) 160px, 320px" unoptimized className="object-cover"/>:<span role={alt?"img":undefined} aria-label={alt||undefined}>{fallback}</span>}</span>;
}
