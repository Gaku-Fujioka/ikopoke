"use client";
import {useActionState,useState} from "react";
import {setOutingCompletedAction,updateMemoryAction,type MemoryActionState} from "@/app/app/groups/[groupId]/memories/actions";
import type {SavedMemory} from "@/lib/memories/repository";
const button="min-h-12 rounded-full bg-orange-700 px-6 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:opacity-50";
const field="min-h-12 w-full rounded-xl border border-stone-300 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700";
export function CompletionForm({groupId,outingId,revision,completed}:{groupId:string;outingId:string;revision:number;completed:boolean}){
  const [state,action,pending]=useActionState(setOutingCompletedAction,{error:null});
  return <section className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-bold">{completed?"このおでかけは終了しました":"思い出の一冊にする"}</h2>
    <p className="text-sm leading-6 text-stone-600">{completed?"間違えて終了した場合は取り消せます。写真・訪問記録とアルバムは残り、再び終了しても同じ一冊を使います。":"このおでかけの訪問記録と、書き足したページやひとことを同じ一冊に残します。候補から直接記録した訪問は含めません。未訪問の候補を行ったことにはしません。写真やメモは後から追加・編集できます。"}</p>
    <form action={action} aria-busy={pending} className="space-y-4"><input type="hidden" name="groupId" value={groupId}/><input type="hidden" name="id" value={outingId}/><input type="hidden" name="revision" value={revision}/><input type="hidden" name="completed" value={String(!completed)}/>
      {!completed&&<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" required className="h-5 w-5 accent-orange-700" disabled={pending}/>おでかけを終了してアルバムにする</label>}
      {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}<button disabled={pending} className={button}>{pending?"保存中…":completed?"終了を取り消す":"終了して思い出を見る"}</button>
    </form>
  </section>;
}
export function MemoryEditForm({memory}:{memory:SavedMemory}){
  const [title,setTitle]=useState(memory.title),[note,setNote]=useState(memory.note),[revision,setRevision]=useState(memory.revision);
  const [state,action,pending]=useActionState(async(previous:MemoryActionState,form:FormData)=>{const result=await updateMemoryAction(previous,form);if(result.savedRevision!==undefined)setRevision(result.savedRevision);return result;},{error:null});
  return <details id="memory-edit" className="rounded-3xl border border-stone-200 bg-white p-6"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-orange-700">表紙のタイトル・あとがきを編集</summary><form action={action} aria-busy={pending} className="mt-4 space-y-4">
    <input type="hidden" name="groupId" value={memory.group_id}/><input type="hidden" name="id" value={memory.id}/><input type="hidden" name="revision" value={revision}/>
    <label className="block space-y-2 font-semibold"><span>タイトル（必須・120文字以内）</span><input name="title" required value={title} onChange={e=>setTitle(e.target.value)} disabled={pending} className={field}/></label>
    <label className="block space-y-2 font-semibold"><span>あとがき（2,000文字以内）</span><textarea name="note" rows={5} value={note} onChange={e=>setNote(e.target.value)} disabled={pending} className={`${field} py-3`}/></label>
    <p className="text-sm text-stone-600">グループ全員に反映されます。各章のメモ・写真は訪問記録から変更できます。</p>
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.savedRevision!==undefined&&state.savedTitle===title.trim()&&state.savedNote===note&&<p role="status" className="text-sm text-stone-600">思い出を保存しました。</p>}<button disabled={pending} className={button}>{pending?"保存中…":"思い出を保存"}</button>
  </form></details>;
}
