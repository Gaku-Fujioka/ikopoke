"use client";
import Image from "next/image";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {isProfilePath} from "@/lib/presentation/colors";
import {useNearbyImage} from "@/components/hooks/use-nearby-image";

type Props={path?:string|null;alt:string;fallback?:string;className?:string};

/** No public/signed URL: each visible image download rechecks current Storage RLS. */
export function ProfileImage({path,alt,fallback="",className=""}:Props){
 const {ref,visible}=useNearbyImage<HTMLSpanElement>("160px");
 return <span ref={ref} aria-hidden={alt?undefined:true} className={`kk-profile-image ${className}`}><ProfileImageContent key={path??"unset"} path={path} alt={alt} fallback={fallback} visible={visible}/></span>;
}
function ProfileImageContent({path,alt,fallback,visible}:Props&{visible:boolean}){
 const [src,setSrc]=useState<string|null>(null);
 useEffect(()=>{
  if(!visible||!isProfilePath(path))return;
  let active=true,local:string|null=null;
  void (async()=>{try{const {data,error}=await createClient().storage.from("visit-photos").download(path);if(!active||error||!data)return;local=URL.createObjectURL(new Blob([data],{type:"image/jpeg"}));setSrc(local);}catch{/* Text/neutral placeholder remains usable. */}})();
  return()=>{active=false;if(local)URL.revokeObjectURL(local);};
 },[path,visible]);
 return src?<Image src={src} alt={alt} fill sizes="(max-width: 640px) 160px, 320px" unoptimized className="object-cover"/>:<span role={alt?"img":undefined} aria-label={alt||undefined}>{fallback}</span>;
}
