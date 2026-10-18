"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createCommentAction } from "@/app/app/groups/[groupId]/items/comment-actions";
import { COMMENT_LIMIT, type CommentState } from "@/lib/items/comments";

export function CommentForm({ groupId, itemId, requestId: initialRequestId, firstPageHref, onFirstPage }: { groupId: string; itemId: string; requestId: string; firstPageHref: string; onFirstPage: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState(""), [requestId, setRequestId] = useState(initialRequestId);
  const [state, action, pending] = useActionState(async (previous: CommentState, form: FormData) => {
    const result = await createCommentAction(previous, form);
    if (result.nextRequestId) {
      setBody(""); setRequestId(result.nextRequestId);
      if (!onFirstPage) router.push(`${firstPageHref}#comments`);
    }
    return result;
  }, { error: null });
  return (
    <form action={action} aria-busy={pending} className="kk-chat-compose">
      <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="comment-body" className="sr-only">コメントを書く</label>
      <div className="kk-chat-input-row"><textarea id="comment-body" name="body" required rows={2} value={body} onChange={event => setBody(event.target.value)} disabled={pending} aria-invalid={Boolean(state.error)} aria-describedby={`comment-help${state.error ? " comment-error" : ""}`} placeholder="ここ、どうかな？" className="kk-chat-input" />
      <button disabled={pending} className="kk-chat-send">{pending ? "投稿中…" : "送る"}</button></div>
      <p id="comment-help" className="text-xs leading-5 text-stone-500">グループのメンバーに共有されます。{COMMENT_LIMIT.toLocaleString("ja-JP")}文字以内（現在 {Array.from(body).length}文字）。自分の投稿は後から編集・削除できます。</p>
      {state.error && <p id="comment-error" role="alert" className="text-sm leading-6 text-red-700">{state.error}</p>}
      {state.nextRequestId && !pending && !body && <p role="status" className="text-sm text-stone-600">コメントを投稿しました。</p>}

    </form>
  );
}
