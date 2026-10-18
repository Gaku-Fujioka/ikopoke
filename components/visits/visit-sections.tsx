import Link from "next/link";
import type {createClient} from "@/lib/supabase/server";
import {getVisitRatings,listVisitPhotos,listVisits,VisitStoreError} from "@/lib/visits/repository";
import {VisitRatingForm} from "@/components/visits/visit-forms";
import {PhotoUpload,PendingPhoto} from "@/components/visits/photo-upload";
import {PrivateVisitImage} from "@/components/visits/private-visit-image";
type Client=Awaited<ReturnType<typeof createClient>>;
export async function VisitRatingSection({client,groupId,visitId}:{client:Client;groupId:string;visitId:string}){
  try{return <VisitRatingForm groupId={groupId} visitId={visitId} ratings={await getVisitRatings(client,groupId,visitId)}/>;}
  catch{return <p role="alert" className="rounded-3xl border bg-white p-6">評価を読み込めませんでした。訪問記録を開き直してください。</p>;}
}
export async function VisitPhotos({client,groupId,visitId,title}:{client:Client;groupId:string;visitId:string;title:string}){
  try{
    const photos=await listVisitPhotos(client,groupId,visitId),ready=photos.filter(photo=>photo.status==="ready"),pending=photos.filter(photo=>photo.status!=="ready");
    return <section className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-bold">訪問写真（{ready.length}枚）</h2>
      {ready.length?<ul className="grid gap-4 sm:grid-cols-2">{ready.map((photo,index)=><li key={photo.id}><PrivateVisitImage path={photo.object_path} contentType={photo.content_type} alt={`${title}の訪問写真 ${index+1}`}/></li>)}</ul>:<p className="text-sm text-stone-600">写真はまだありません。</p>}
      {pending.length>0&&<ul className="space-y-3">{pending.map(photo=><PendingPhoto key={photo.id} groupId={groupId} visitId={visitId} photoId={photo.id} cancelling={photo.status==="cancelling"}/>)}</ul>}
      <PhotoUpload groupId={groupId} visitId={visitId}/>
    </section>;
  }catch{return <p role="alert" className="rounded-3xl border bg-white p-6">写真を読み込めませんでした。訪問記録を開き直してください。</p>;}
}
export async function VisitHistory({client,groupId,itemId,outingId}:{client:Client;groupId:string;itemId?:string;outingId?:string}){
  const query=new URLSearchParams();if(itemId)query.set("item",itemId);if(outingId)query.set("outing",outingId);
  const href=`/app/groups/${groupId}/visits${query.size?`?${query}`:""}`;
  try{
    const saved=await listVisits(client,groupId,1,{itemId,outingId});
    return <section className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-bold">訪問記録（{saved.total}件）</h2>{saved.total?<ul className="space-y-2">{saved.visits.slice(0,3).map(visit=><li key={visit.id}><Link href={`/app/groups/${groupId}/visits/${visit.id}`} className="inline-flex min-h-11 items-center gap-3 font-semibold text-orange-700 underline"><time dateTime={visit.visited_on}>{visit.visited_on}</time><span className="break-words">{visit.item_title}</span></Link></li>)}</ul>:<p className="text-sm text-stone-600">訪問記録はまだありません。</p>}<Link href={href} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">訪問記録の一覧へ</Link></section>;
  }catch(cause){return <p role="alert" className="rounded-3xl border bg-white p-6">{cause instanceof VisitStoreError?cause.message:"訪問記録を読み込めませんでした。"}</p>;}
}
