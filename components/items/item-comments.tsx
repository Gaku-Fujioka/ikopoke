import { CommentManagement } from "@/components/items/item-management";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getNamedComments, CommentError, COMMENT_PAGE_SIZE } from "@/lib/items/comments";
import { CommentForm } from "@/components/items/comment-form";
import { RetryItems } from "@/components/items/retry-items";
import { sharedItemCommentsHref } from "@/lib/items/search";
import {ProfileImage} from "@/components/profiles/profile-image";

const commentDate = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export async function ItemComments({ client, groupId, itemId, page, detailHref }: { client: SupabaseClient<Database>; groupId: string; itemId: string; page: number; detailHref: string }) {
  let saved;
  try { saved = await getNamedComments(client, groupId, itemId, page); }
  catch (cause) {
    return <section id="comments" aria-label="コメント" className="space-y-3 rounded-3xl border border-stone-200 bg-white p-6">
      <h2 className="text-xl font-semibold">コメント</h2>
      <p role="status" className="text-sm leading-6 text-stone-600">{cause instanceof CommentError ? cause.message : "コメントを読み込めませんでした。もう一度お試しください。"}</p><RetryItems />
    </section>;
  }
  const href = (number: number) => sharedItemCommentsHref(detailHref, number);
  return (
    <section id="comments" aria-labelledby="comments-heading" className="kk-item-conversation scroll-mt-6 space-y-5">
      <h2 id="comments-heading" className="text-xl font-semibold">ここで話そう <span className="text-sm font-normal text-stone-600">{saved.total}件</span></h2>
      <p className="text-xs leading-5 text-stone-500">表示中の会話は上から時間順。新しい投稿は再読み込みで反映されます。</p>
      {(page > 1 || page * COMMENT_PAGE_SIZE < saved.total) && <nav aria-label="コメントのページ" className="kk-chat-pagination">
        {page * COMMENT_PAGE_SIZE < saved.total && <Link href={href(page+1)+'#comments'} className="kk-text-link">前の会話を見る ↑</Link>}
        {page > 1 && <><Link href={href(page-1)+'#comments'} className="kk-text-link">新しい会話へ ↓</Link><Link href={href(1)+'#comments'} className="kk-text-link">最新の会話へ</Link></>}
        <span>{page}ページ</span>
      </nav>}
      {saved.comments.length ? <ol className="kk-chat-messages" aria-label="ここでの会話">
        {[...saved.comments].reverse().map(comment => <li key={comment.id} className="kk-chat-row" data-mine={comment.is_mine}>
          {!comment.is_mine && <ProfileImage path={comment.avatar_path} alt="" className="kk-chat-avatar" fallback={Array.from(comment.display_name)[0] || '・'}/>}
          <div className="kk-chat-content"><p className="kk-chat-name">{comment.display_name}{comment.is_mine ? '（あなた）' : ''}</p>
            <div className="kk-chat-bubble"><p>{comment.body}</p></div>
            <p className="kk-chat-time"><time dateTime={comment.created_at}>{commentDate.format(new Date(comment.created_at))}</time><span className="sr-only">（日本時間）</span></p>
            <CommentManagement groupId={groupId} itemId={itemId} comment={comment} />
          </div>
        </li>)}
      </ol> : <p className="kk-chat-empty">{page > 1 ? 'このページには会話がありません。' : 'ここ、どうかな？ 気になることを話してみよう。'}</p>}
      <CommentForm groupId={groupId} itemId={itemId} requestId={randomUUID()} firstPageHref={href(1)} onFirstPage={page === 1} />
    </section>
  );
}
