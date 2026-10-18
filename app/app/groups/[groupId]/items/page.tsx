import { ItemExtraFilters } from "@/components/items/item-extra-filters";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getGroup, GroupStoreError } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { listItems, ITEM_PAGE_SIZE, ItemStoreError } from "@/lib/items/repository";
import { itemPage } from "@/lib/items/validation";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { CandidateCard } from "@/components/home/collection-cards";
import { RetryItems } from "@/components/items/retry-items";
import { itemSearchQuery, itemFilters, validItemSearch, sharedItemListHref, sharedItemDetailHref } from "@/lib/items/search";

type ExtraSearch = { archived?: string; visited?: string; priority?: string; sort?: string };
type Props = { params: Promise<{ groupId: string }>; searchParams: Promise<ExtraSearch & { page?: string | string[]; q?: string | string[]; kind?: string | string[]; reaction?: string | string[]; list?: string | string[] }> };

async function ItemsContent({ params, searchParams }: Props) {
  const { groupId } = await params;
  if (!isGroupId(groupId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const search = await searchParams;
  const page = itemPage(search.page);
  const query = itemSearchQuery(search.q);
  const filters = itemFilters(search);
  const hasConditions = Boolean(query || filters.kind || filters.reaction || filters.list || filters.archived || filters.visited || filters.priority !== undefined || filters.sort === "recommended");
  const searchError = !validItemSearch(query);
  const listPath = `/app/groups/${groupId}/items`;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(sharedItemListHref(groupId, query, page, filters))}`);
  let group;
  let saved;
  try {
    // RLS and the explicit group filter apply to both independent reads.
    [group, saved] = await Promise.all([
      getGroup(client, groupId),
      searchError ? Promise.resolve({ items: [], total: 0 }) : listItems(client, groupId, page, query, filters),
    ]);
  } catch (cause) {
    return (
      <div role="alert" className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6">
        <p>{cause instanceof GroupStoreError || cause instanceof ItemStoreError ? cause.message : "候補を読み込めませんでした。もう一度お試しください。"}</p>
        <RetryItems />
        {hasConditions && <Link href={listPath} className="inline-flex min-h-11 items-center px-3 font-semibold text-orange-700 underline underline-offset-4">条件を解除</Link>}
        <Link href={`/app/groups/${groupId}`} className="inline-flex min-h-11 items-center px-3 font-semibold text-stone-600 underline underline-offset-4">グループへ</Link>
      </div>
    );
  }
  if (!group || !saved) notFound();
  return (
    <div className="space-y-7">
      <Link href={`/app/groups/${groupId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-stone-600 underline underline-offset-4">← グループへ</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-orange-700">{group.name}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">みんなの候補</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">気になる場所も、やってみたいことも。一緒にためよう。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3"><Link href={`/app/groups/${groupId}/lists`} className="kk-text-link">リストで整理</Link><Link href={`/app/groups/${groupId}/items/new`} className="kk-primary-link">＋ 候補を追加</Link></div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm"><Link href={sharedItemListHref(groupId,"",1,{list:"unclassified"})} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">未分類の候補を見る</Link>{filters.list && <span className="inline-flex min-h-11 items-center rounded-full bg-orange-50 px-4 font-semibold text-orange-800">{filters.list === "unclassified" ? "未分類" : "リストで絞り込み中"}</span>}</div>
      <form action={listPath} method="get" role="search" className="flex flex-wrap items-end gap-3 rounded-3xl border border-stone-200 bg-white p-5">
        {filters.list && <input type="hidden" name="list" value={filters.list} />}
        <div className="min-w-0 flex-1 basis-48 space-y-2">
          <label htmlFor="shared-item-search" className="block text-sm font-semibold">候補の名前で検索</label>
          <input key={query} id="shared-item-search" name="q" type="search" defaultValue={query} aria-invalid={searchError} aria-describedby={searchError ? "shared-search-error" : undefined} placeholder="名前の一部を入力" className="min-h-12 w-full rounded-xl border border-stone-300 px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700" />
        </div>
        <div className="space-y-2">
          <label htmlFor="shared-item-kind" className="block text-sm font-semibold">種類</label>
          <select key={filters.kind ?? "all"} id="shared-item-kind" name="kind" defaultValue={filters.kind ?? ""} className="min-h-12 rounded-xl border border-stone-300 bg-white px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">
            <option value="">すべて</option><option value="spot">スポット</option><option value="activity">やりたいこと</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="shared-item-reaction" className="block text-sm font-semibold">自分の反応</label>
          <select key={filters.reaction ?? "all"} id="shared-item-reaction" name="reaction" defaultValue={filters.reaction ?? ""} className="min-h-12 rounded-xl border border-stone-300 bg-white px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">
            <option value="">すべて</option><option value="want_to_go">行きたい！</option><option value="not_now">そこまで</option><option value="unreacted">未反応</option>
          </select>
        </div>
        <ItemExtraFilters filters={filters} />
        <button type="submit" className="min-h-12 rounded-full bg-stone-900 px-6 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2">検索・絞り込み</button>
        {hasConditions && <Link href={listPath} className="inline-flex min-h-12 items-center px-3 font-semibold text-orange-700 underline underline-offset-4">条件を解除</Link>}
        {searchError && <p id="shared-search-error" role="alert" className="w-full text-sm text-red-700">検索語は100文字以内で入力してください。</p>}
      </form>
      {!searchError && <section aria-label="保存した候補" className="space-y-4">
        <p role="status" className="break-words text-sm text-stone-600">{query ? `「${query}」の検索結果：${saved.total}件` : hasConditions ? `条件に合う候補：${saved.total}件` : `全${saved.total}件`}</p>
        {saved.items.length ? (
          <ul className="kk-collection-grid">
            {saved.items.map((item) => (
              <li key={item.id} className="min-w-0">
                <CandidateCard item={item} groupName={group.name} href={sharedItemDetailHref(groupId, item.id, query, page, filters)} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-3xl border border-stone-200 bg-white p-6">
            <h2 className="text-xl font-semibold">{page > 1 ? "このページには候補がありません" : hasConditions ? "条件に合う候補がありません" : "候補がまだありません"}</h2>
            <p className="mt-2 leading-7 text-stone-600">{page > 1 ? "最初のページから候補をご確認ください。" : hasConditions ? "検索・絞り込みの条件を変えるか、条件を解除してお試しください。" : "気になる場所や、やりたいことを一つ追加しましょう。"}</p>
            {page > 1 && <Link href={sharedItemListHref(groupId, query, 1, filters)} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">最初のページへ</Link>}
          </div>
        )}
        {(page > 1 || page * ITEM_PAGE_SIZE < saved.total) && (
          <nav aria-label="候補一覧のページ" className="flex flex-wrap items-center gap-5">
            {page > 1 && <Link href={sharedItemListHref(groupId, query, page - 1, filters)} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">前のページ</Link>}
            <span className="text-sm text-stone-600">{page}ページ</span>
            {page * ITEM_PAGE_SIZE < saved.total && <Link href={sharedItemListHref(groupId, query, page + 1, filters)} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">次のページ</Link>}
          </nav>
        )}
      </section>}
    </div>
  );
}

export default function SharedItemsPage(props: Props) {
  return <Suspense fallback={<p role="status">候補を読み込んでいます…</p>}>
    <ItemsContent {...props} />
  </Suspense>;
}
