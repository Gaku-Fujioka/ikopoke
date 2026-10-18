import { ItemManagement } from "@/components/items/item-management";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getGroup, GroupStoreError } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { getItem, ItemStoreError } from "@/lib/items/repository";
import { itemPage } from "@/lib/items/validation";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { RetryItems } from "@/components/items/retry-items";
import { ItemReactionSection } from "@/components/items/item-reaction-section";
import { EditItemForm } from "@/components/items/edit-item-form";
import { ItemComments } from "@/components/items/item-comments";
import { ItemLists } from "@/components/lists/item-lists";
import { VisitHistory } from "@/components/visits/visit-sections";
import { listQuery } from "@/lib/lists/validation";
import { googleMapsSearchHref } from "@/lib/maps/explorer";
import { itemSearchQuery, itemFilters, allItemListHref, sharedItemListHref, sharedItemDetailHref, sharedItemCommentsHref, sharedItemListsHref } from "@/lib/items/search";

type ExtraSearch = { archived?: string; visited?: string; priority?: string; sort?: string };
type Props = { params: Promise<{ groupId: string; itemId: string }>; searchParams: Promise<ExtraSearch & { origin?: string | string[]; page?: string | string[]; q?: string | string[]; kind?: string | string[]; reaction?: string | string[]; list?: string | string[]; commentsPage?: string | string[]; listsPage?: string | string[]; listsQ?: string | string[] }> };

async function ItemContent({ params, searchParams }: Props) {
  const { groupId, itemId } = await params;
  if (!isGroupId(groupId) || !isGroupId(itemId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const search = await searchParams;
  const page = itemPage(search.page);
  const query = itemSearchQuery(search.q);
  const filters = itemFilters(search);
  const listPath = search.origin === "all" ? allItemListHref(query, page, filters.kind, filters) : sharedItemListHref(groupId, query, page, filters);
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const localHref = sharedItemDetailHref(groupId, itemId, query, page, filters);
  const detailHref = search.origin === "all" ? `${localHref}${localHref.includes("?") ? "&" : "?"}origin=all` : localHref;
  const commentsPage = itemPage(search.commentsPage);
  const listsPage = itemPage(search.listsPage), listsQ = listQuery(search.listsQ);
  const currentHref = sharedItemCommentsHref(sharedItemListsHref(detailHref, listsPage, listsQ), commentsPage);
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(currentHref)}`);
  let group;
  let item;
  try {
    // Both reads enforce membership in the DB and are scoped to this group.
    // Neither needs the result of the other.
    [group, item] = await Promise.all([getGroup(client, groupId), getItem(client, groupId, itemId)]);
  } catch (cause) {
    return (
      <div role="alert" className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6">
        <p>{cause instanceof GroupStoreError || cause instanceof ItemStoreError ? cause.message : "候補を読み込めませんでした。もう一度お試しください。"}</p>
        <RetryItems />
        <Link href={listPath} className="inline-flex min-h-11 items-center px-3 font-semibold text-stone-600 underline underline-offset-4">候補一覧へ</Link>
      </div>
    );
  }
  if (!group || !item) notFound();
  return (
    <div className="kk-spot-detail mx-auto max-w-3xl space-y-5">
      <Link href={listPath} className="inline-flex min-h-11 items-center text-sm font-semibold text-stone-600 underline underline-offset-4">← みんなの候補へ</Link>
      <article className="kk-item-hero">
        <p className="break-words text-sm font-semibold text-orange-700">{group.name} / {item.kind === "spot" ? "スポット" : "やりたいこと"}</p>
        <div className="kk-item-title"><span aria-hidden="true" className="kk-item-doodle">{item.kind === "spot" ? "✦" : "☀"}</span><h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{item.title}</h1><EditItemForm groupId={groupId} itemId={itemId} title={item.title} memo={item.memo} field="title" /></div>
        {item.kind === "spot" && <p className="flex flex-wrap items-center gap-x-3 text-xs text-stone-500"><a href={googleMapsSearchHref(item.title)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-stone-600 underline underline-offset-4">Googleマップで探す ↗<span className="sr-only">（新しいタブ）</span></a><span>この名前で検索します</span></p>}
        <div className="kk-spot-actions">{!item.archived_at && <Link href={`/app/groups/${groupId}/outings/new?item=${itemId}`} className="kk-primary-link">この行き先で計画する →</Link>}{!item.archived_at && <Link href={`/app/groups/${groupId}/outings/add?items=${itemId}`} className="kk-secondary-link">予定に追加</Link>}<Link href="#item-lists" className="kk-secondary-link">リストにまとめる ↓</Link><Link href={`/app/groups/${groupId}/visits/new?item=${itemId}`} className="kk-text-link">行った！を記録する</Link></div>

      </article>
      {item.archived_at && <p className="kk-notice">アーカイブ中です。既存の計画・訪問記録は残っています。</p>}
      <Suspense fallback={<section role="status" aria-label="リアクション" className="rounded-3xl border border-stone-200 bg-white p-6">反応を読み込んでいます…</section>}>
        <ItemReactionSection client={client} groupId={groupId} itemId={itemId} />
      </Suspense>

      <Suspense fallback={<section role="status" aria-label="リスト" className="rounded-3xl border border-stone-200 bg-white p-6">リストを読み込んでいます…</section>}>
        <ItemLists client={client} groupId={groupId} itemId={itemId} page={listsPage} query={listsQ} detailHref={currentHref} />
      </Suspense>
      <section aria-labelledby="item-memo-heading" className="kk-item-memo"><div className="kk-section-heading"><h2 id="item-memo-heading">{item.kind === "spot" ? "この場所、気になる理由" : "やってみたい理由"}</h2><EditItemForm groupId={groupId} itemId={itemId} title={item.title} memo={item.memo} field="memo" /></div><p className="whitespace-pre-wrap break-words leading-7 text-stone-700">{item.memo || "メモはまだありません。気になることを残してみよう。"}</p></section>
      <ItemManagement groupId={groupId} itemId={itemId} priority={item.priority} archived={Boolean(item.archived_at)} />

      <Suspense fallback={<section role="status" aria-label="コメント" className="rounded-3xl border border-stone-200 bg-white p-6">コメントを読み込んでいます…</section>}>
        <ItemComments client={client} groupId={groupId} itemId={itemId} page={commentsPage} detailHref={currentHref} />
      </Suspense>
      <Suspense fallback={<p role="status">訪問記録を読み込んでいます…</p>}><VisitHistory client={client} groupId={groupId} itemId={itemId} /></Suspense>
      <ItemManagement view="archive" groupId={groupId} itemId={itemId} priority={item.priority} archived={Boolean(item.archived_at)} />
    </div>
  );
}

export default function SharedItemPage(props: Props) {
  return <Suspense fallback={<p role="status">候補を読み込んでいます…</p>}>
    <ItemContent {...props} />
  </Suspense>;
}
