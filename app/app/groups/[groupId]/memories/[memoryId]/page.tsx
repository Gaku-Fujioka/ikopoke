import { CoverEditor } from "@/components/memories/cover-editor";
import {Suspense} from "react";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {hasEnvVars} from "@/lib/utils";
import {isGroupId} from "@/lib/groups/validation";
import {getMemory,getMemoryContent,type SavedMemory} from "@/lib/memories/repository";
import {orderMemoryVisits} from "@/lib/memories/order";
import {getOuting} from "@/lib/outings/repository";
import {AuthSetupNotice} from "@/components/auth-setup-notice";
import {MemoryBook} from "@/components/memories/memory-book";
import {MemoryEditForm,CompletionForm} from "@/components/memories/memory-forms";
async function BookContent({memory}:{memory:SavedMemory}){
  try{
    const client=await createClient();const [content,outing]=await Promise.all([getMemoryContent(client,memory),getOuting(client,memory.group_id,memory.outing_id)]);
    if(!outing)return <p role="alert">関連する計画を読み込めませんでした。もう一度お試しください。</p>;
    return <><p className="rounded-2xl bg-orange-50 p-4 text-sm leading-6 text-stone-700">{outing.outing.completed_at?"終了したおでかけの思い出です。":"終了を取り消し、計画に戻しています。この一冊と記録は残っています。"}</p><MemoryBook memory={memory} visits={orderMemoryVisits(content.visits,outing.items)} photos={content.photos}/><CoverEditor key={memory.revision} memory={memory} photos={content.photos}/><CompletionForm groupId={memory.group_id} outingId={memory.outing_id} revision={outing.outing.revision} completed={!!outing.outing.completed_at}/></>;
  }catch{return <p role="alert">訪問や写真の情報を読み込めませんでした。思い出を開き直してください。</p>;}
}
async function Content({params}:{params:Promise<{groupId:string;memoryId:string}>}){
  const {groupId,memoryId}=await params;if(!isGroupId(groupId)||!isGroupId(memoryId))notFound();
  if(!hasEnvVars)return <AuthSetupNotice/>;
  const client=await createClient(),{data,error}=await client.auth.getClaims();
  if(error||!data?.claims?.sub)redirect(`/auth/login?next=${encodeURIComponent(`/app/groups/${groupId}/memories/${memoryId}`)}`);
  let memory;try{memory=await getMemory(client,groupId,memoryId);}catch{return <p role="alert">思い出を読み込めませんでした。もう一度お試しください。</p>;}
  if(!memory)notFound();
  return <div className="space-y-6"><div className="flex flex-wrap gap-5"><Link href={`/app/groups/${groupId}/memories`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">← 思い出一覧へ</Link><Link href={`/app/groups/${groupId}/outings/${memory.outing_id}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">おでかけ計画へ</Link></div><Suspense fallback={<p role="status">思い出の本を読み込んでいます…</p>}><BookContent memory={memory}/></Suspense><MemoryEditForm memory={memory}/></div>;
}
export default function MemoryPage(props:{params:Promise<{groupId:string;memoryId:string}>}){return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status">思い出を読み込んでいます…</p>}><Content {...props}/></Suspense></div>;}
