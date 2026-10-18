import {randomUUID} from "node:crypto";
import {Suspense} from "react";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {hasEnvVars} from "@/lib/utils";
import {isGroupId} from "@/lib/groups/validation";
import {getGroup} from "@/lib/groups/repository";
import {getItem} from "@/lib/items/repository";
import {getOuting} from "@/lib/outings/repository";
import {isCalendarDate,japanCalendarToday} from "@/lib/outings/calendar";
import {AuthSetupNotice} from "@/components/auth-setup-notice";
import {CreateVisitForm} from "@/components/visits/visit-forms";
type Props={params:Promise<{groupId:string}>;searchParams:Promise<{item?:string|string[];outing?:string|string[];stop?:string|string[];date?:string|string[]}>};
async function Content({params,searchParams}:Props){
  const {groupId}=await params,search=await searchParams;
  if(!isGroupId(groupId)||!isGroupId(search.item)||(search.outing!==undefined&&!isGroupId(search.outing)))notFound();
  if(!hasEnvVars)return <AuthSetupNotice/>;
  if(search.stop!==undefined&&(!isGroupId(search.stop)||!isGroupId(search.outing)))notFound();
  const stopId=typeof search.stop==="string"?search.stop:null;
  const itemId=search.item,outingId=typeof search.outing==="string"?search.outing:null;
  const query=new URLSearchParams({item:itemId});if(outingId)query.set("outing",outingId);if(stopId)query.set("stop",stopId);if(isCalendarDate(search.date))query.set("date",search.date);
  const client=await createClient(),{data,error}=await client.auth.getClaims();
  if(error||!data?.claims?.sub)redirect(`/auth/login?next=${encodeURIComponent(`/app/groups/${groupId}/visits/new?${query}`)}`);
  let group,item,outing;
  try{[group,item,outing]=await Promise.all([getGroup(client,groupId),getItem(client,groupId,itemId),outingId?getOuting(client,groupId,outingId):Promise.resolve(null)]);}
  catch{return <p role="alert">訪問記録の画面を読み込めませんでした。候補から開き直してください。</p>;}
  if(!group||!item||(outingId&&(!outing||!outing.items.some(slot=>slot.item_id===itemId&&(!stopId||slot.id===stopId)))))notFound();
  const initialDate=isCalendarDate(search.date)?search.date:outing?.outing.outing_date??japanCalendarToday(new Date());
  return <div className="space-y-6"><Link href={outingId?`/app/groups/${groupId}/outings/${outingId}`:`/app/groups/${groupId}/items/${itemId}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">← {outingId?"おでかけ計画":"候補"}へ</Link><div><p className="text-sm font-semibold text-orange-700">{group.name}</p><h1 className="mt-2 text-3xl font-bold">訪問を記録</h1><p className="mt-3 text-stone-600">{outing?`${outing.outing.title}での訪問を残します。`:"計画なしの訪問も残せます。"}</p></div><CreateVisitForm groupId={groupId} itemId={itemId} outingId={outingId} stopId={stopId} title={item.title} initialDate={initialDate} requestId={randomUUID()}/></div>;
}
export default function NewVisitPage(props:Props){return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status">訪問記録の画面を読み込んでいます…</p>}><Content {...props}/></Suspense></div>;}
