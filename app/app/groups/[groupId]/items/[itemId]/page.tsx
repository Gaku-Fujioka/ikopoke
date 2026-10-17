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
import { itemSearchQuery, itemFilters, sharedItemListHref, sharedItemDetailHref, sharedItemCommentsHref } from "@/lib/items/search";

type Props = { params: Promise<{ groupId: string; itemId: string }>; searchParams: Promise<{ page?: string | string[]; q?: string | string[]; kind?: string | string[]; reaction?: string | string[]; commentsPage?: string | string[] }> };

async function ItemContent({ params, searchParams }: Props) {
  const { groupId, itemId } = await params;
  if (!isGroupId(groupId) || !isGroupId(itemId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const search = await searchParams;
  const page = itemPage(search.page);
  const query = itemSearchQuery(search.q);
  const filters = itemFilters(search);
  const listPath = sharedItemListHref(groupId, query, page, filters);
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const detailHref = sharedItemDetailHref(groupId, itemId, query, page, filters);
  const commentsPage = itemPage(search.commentsPage);
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(sharedItemCommentsHref(detailHref, commentsPage))}`);
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
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={listPath} className="inline-flex min-h-11 items-center text-sm font-semibold text-stone-600 underline underline-offset-4">← みんなの候補へ</Link>
      <article className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
        <p className="break-words text-sm font-semibold text-orange-700">{group.name} / {item.kind === "spot" ? "スポット" : "やりたいこと"}</p>
        <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{item.title}</h1>
        <p className="text-sm leading-6 text-stone-600">このグループのメンバーに共有されています。</p>
        <section aria-labelledby="item-memo-heading" className="border-t border-stone-200 pt-5">
          <h2 id="item-memo-heading" className="font-semibold">メモ</h2>
          <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-stone-700">{item.memo || "メモはまだありません。"}</p>
        </section>
      </article>
      <EditItemForm groupId={groupId} itemId={itemId} title={item.title} memo={item.memo} />
      <Suspense fallback={<section role="status" aria-label="リアクション" className="rounded-3xl border border-stone-200 bg-white p-6">反応を読み込んでいます…</section>}>
        <ItemReactionSection client={client} groupId={groupId} itemId={itemId} />
      </Suspense>
      <Suspense fallback={<section role="status" aria-label="コメント" className="rounded-3xl border border-stone-200 bg-white p-6">コメントを読み込んでいます…</section>}>
        <ItemComments client={client} groupId={groupId} itemId={itemId} page={commentsPage} detailHref={detailHref} />
      </Suspense>
    </div>
  );
}

export default function SharedItemPage(props: Props) {
  return <Suspense fallback={<p role="status">候補を読み込んでいます…</p>}>
    <ItemContent {...props} />
  </Suspense>;
}
