import { CommentManagement } from "@/components/items/item-management";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getNamedComments, CommentError, COMMENT_PAGE_SIZE } from "@/lib/items/comments";
import { CommentForm } from "@/components/items/comment-form";
import { RetryItems } from "@/components/items/retry-items";
import { sharedItemCommentsHref } from "@/lib/items/search";

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
      <p className="text-xs leading-5 text-stone-500">新しい順に表示します。ほかの人の投稿は再読み込みで反映されます。自分の投稿は編集できます。</p>
      {saved.comments.length ? <ul className="space-y-4">
        {saved.comments.map(comment => <li key={comment.id} className="rounded-2xl bg-stone-50 p-4">
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-600"><span className="font-semibold">{comment.display_name}{comment.is_mine ? "（あなた）" : ""}</span><time dateTime={comment.created_at}>{commentDate.format(new Date(comment.created_at))}（日本時間）</time></p>
          <p className="mt-3 whitespace-pre-wrap break-words leading-7">{comment.body}</p>
          <CommentManagement groupId={groupId} itemId={itemId} comment={comment} />
        </li>)}
      </ul> : <p className="text-sm text-stone-600">{page > 1 ? "このページにはコメントがありません。" : "コメントはまだありません。気になることを話してみましょう。"}</p>}
      {(page > 1 || page * COMMENT_PAGE_SIZE < saved.total) && <nav aria-label="コメントのページ" className="flex flex-wrap items-center gap-4 text-sm">
        {page > 1 && <><Link href={`${href(1)}#comments`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">最新のコメントへ</Link><Link href={`${href(page - 1)}#comments`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">前のページ</Link></>}
        <span>{page}ページ</span>
        {page * COMMENT_PAGE_SIZE < saved.total && <Link href={`${href(page + 1)}#comments`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">次のページ</Link>}
      </nav>}
      <CommentForm groupId={groupId} itemId={itemId} requestId={randomUUID()} firstPageHref={href(1)} onFirstPage={page === 1} />
    </section>
  );
}
