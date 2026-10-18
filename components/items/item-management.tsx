"use client";

import { useActionState } from "react";
import { manageItemAction } from "@/app/app/groups/[groupId]/items/manage-actions";

function Result({ error, saved, pending }: { error: string | null; saved?: boolean; pending: boolean }) {
  return error ? <p role="alert" className="text-sm text-red-700">{error}</p> : pending || saved ? <p role="status" className="text-sm text-stone-600">{pending ? "保存中…" : "保存しました。"}</p> : null;
}
export function ItemManagement({ groupId, itemId, priority = 0, archived = false, view = "priority" }: { groupId: string; itemId: string; priority?: number; archived?: boolean; view?: "priority" | "archive" }) {
  const [state, action, pending] = useActionState(manageItemAction, { error: null });
  return <details className="kk-inline-editor"><summary className="kk-edit-button">{view === "priority" ? `優先度：${["未設定", "低", "中", "高"][priority]} · 変更` : "… 候補の管理"}</summary>
    <form key={`${priority}-${archived}`} action={action} className="mt-4 space-y-4" aria-busy={pending}>
      <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="operation" value="attributes" /><input type="hidden" name="expectedPriority" value={priority} /><input type="hidden" name="expectedArchived" value={archived ? "1" : "0"} />
      {view === "archive" ? <input type="hidden" name="priority" value={priority} /> : <label className="block space-y-2"><span className="text-sm font-semibold">みんなの優先度</span><select name="priority" defaultValue={priority} className="min-h-12 w-full rounded-xl border bg-white px-3"><option value="0">未設定（0点）</option><option value="1">低（1点）</option><option value="2">中（2点）</option><option value="3">高（3点）</option></select></label>}
      <p className="text-xs text-stone-600">おすすめ順は「行きたい！の人数＋優先度点」。グループ全員で変更できます。</p>
      {view === "priority" ? <input type="hidden" name="archived" value={archived ? "1" : "0"} /> : <label className="block space-y-2"><span className="text-sm font-semibold">表示</span><select name="archived" defaultValue={archived ? "1" : "0"} className="min-h-12 w-full rounded-xl border bg-white px-3"><option value="0">通常の候補</option><option value="1">アーカイブ（記録は残す）</option></select></label>}
      {view === "archive" && !archived && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="confirm" value="yes" />アーカイブすると通常一覧と新しい計画の候補から外れることを確認しました。</label>}
      <Result {...state} pending={pending} /><button disabled={pending} className="kk-primary-link disabled:opacity-50">変更を保存</button>
    </form></details>;
}
export function CommentManagement({ groupId, itemId, comment }: { groupId: string; itemId: string; comment: { id: string; body: string; revision: number; is_mine: boolean; can_delete: boolean } }) {
  const [state, action, pending] = useActionState(manageItemAction, { error: null });
  if (!comment.is_mine && !comment.can_delete) return null;
  return <details className="mt-3"><summary className="min-h-11 cursor-pointer text-xs font-semibold">{comment.is_mine ? "編集・削除" : "退出したメンバーのコメントを削除"}</summary><form action={action} className="space-y-3" aria-busy={pending}>
    <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="commentId" value={comment.id} /><input type="hidden" name="revision" value={comment.revision} />
    {comment.is_mine && <><label className="block text-sm">コメント<textarea key={comment.revision} name="body" defaultValue={comment.body} rows={3} className="mt-2 w-full rounded-xl border bg-white p-3 text-base" /></label><button name="operation" value="editComment" disabled={pending} className="kk-text-link">編集を保存</button></>}
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="confirm" value="yes" />このコメントを削除します（取り消せません）</label><button name="operation" value="deleteComment" disabled={pending} className="min-h-11 text-sm font-semibold text-red-700">削除する</button><Result {...state} pending={pending} />
  </form></details>;
}
