"use client";
import { useActionState, useState } from "react";
import { manageVisitAction } from "@/app/app/groups/[groupId]/visits/manage-actions";
import type { VisitPhoto } from "@/lib/visits/repository";
import { PrivateVisitImage } from "./private-visit-image";

export function PhotoManagement({ groupId, visitId, photos, deletable, title }: { groupId: string; visitId: string; photos: VisitPhoto[]; deletable: string[]; title: string }) {
  const [ids, setIds] = useState(photos.map(p => p.id));
  const [state, action, pending] = useActionState(manageVisitAction, { error: null });
  function move(index: number, offset: number) { setIds(before => { const next = [...before]; [next[index], next[index+offset]] = [next[index+offset], next[index]]; return next; }); }
  return <div className="space-y-4"><ol className="grid gap-4 sm:grid-cols-2">{ids.map((id, index) => { const photo = photos.find(p => p.id === id)!; return <li key={id} className="space-y-2"><PrivateVisitImage path={photo.object_path} contentType={photo.content_type} alt={`${title}の訪問写真 ${index+1}`} /><div className="flex items-center gap-4"><span className="text-xs text-stone-600">{index+1}枚目</span><button type="button" onClick={() => move(index, -1)} disabled={pending || index === 0} aria-label={`${index+1}枚目を前へ`} className="min-h-11 min-w-11 rounded-full border disabled:opacity-30">←</button><button type="button" onClick={() => move(index, 1)} disabled={pending || index === ids.length-1} aria-label={`${index+1}枚目を後ろへ`} className="min-h-11 min-w-11 rounded-full border disabled:opacity-30">→</button></div>{deletable.includes(id) && <DeleteVisitContent groupId={groupId} visitId={visitId} photoId={id} />}</li>; })}</ol>
    {ids.length > 1 && <form action={action} aria-busy={pending}><input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="visitId" value={visitId} /><input type="hidden" name="operation" value="order" /><input type="hidden" name="ids" value={JSON.stringify(ids)} /><input type="hidden" name="expectedIds" value={JSON.stringify(photos.map(p => p.id))} /><button disabled={pending} className="kk-primary-link">{pending ? "保存中…" : "写真の順番を保存"}</button><p className="mt-2 text-xs text-stone-600">訪問記録とアルバムで同じ順番になります。</p></form>}
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.saved && <p role="status">順番を保存しました。</p>}
  </div>;
}
export function DeleteVisitContent({ groupId, visitId, photoId, revision }: { groupId: string; visitId: string; photoId?: string; revision?: number }) {
  const [state, action, pending] = useActionState(manageVisitAction, { error: null });
  return <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3 font-semibold text-red-700">{photoId ? "この写真を削除" : "訪問記録を削除"}</summary><form action={action} className="space-y-3" aria-busy={pending}><input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="visitId" value={visitId} /><input type="hidden" name="operation" value={photoId ? "deletePhoto" : "deleteVisit"} />{photoId ? <input type="hidden" name="photoId" value={photoId} /> : <input type="hidden" name="revision" value={revision} />}<p>{photoId ? "写真の実体も削除します。表紙に使っている場合は未設定に戻ります。" : "この訪問のメモ・評価と、他のメンバーの写真を含むすべての写真を削除します。本で編集した章名と、この訪問ページのみんなのひとことも削除します。自由ページ・候補・計画・アルバム本体は残ります。"}取り消せません。</p><label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="confirm" value="yes" required />削除する内容を確認しました</label><button disabled={pending} className="min-h-11 rounded-full bg-red-700 px-5 font-semibold text-white disabled:opacity-50">{pending ? "削除中…" : "削除する"}</button>{state.error && <p role="alert" className="text-red-700">{state.error}</p>}</form></details>;
}
