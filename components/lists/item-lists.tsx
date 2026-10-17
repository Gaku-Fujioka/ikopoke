import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getItemLists, ListStoreError } from "@/lib/lists/repository";
import { LIST_PAGE_SIZE, listHref, validListQuery } from "@/lib/lists/validation";
import { sharedItemListsHref } from "@/lib/items/search";
import { ItemListButton } from "@/components/lists/item-list-button";
import { RetryItems } from "@/components/items/retry-items";

export async function ItemLists({ client, groupId, itemId, page, query, detailHref }: { client: SupabaseClient<Database>; groupId: string; itemId: string; page: number; query: string; detailHref: string }) {
  const invalid = !validListQuery(query);
  let saved;
  try { saved = invalid ? { lists: [], total: 0 } : await getItemLists(client, groupId, itemId, page, query); }
  catch (cause) { return <section id="item-lists" className="space-y-3 rounded-3xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-semibold">リストに分類</h2><p role="status" className="text-sm text-stone-600">{cause instanceof ListStoreError ? cause.message : "リストを読み込めませんでした。"}</p><RetryItems /></section>; }
  const href = (number: number) => `${sharedItemListsHref(detailHref,number,query)}#item-lists`;
  return <section id="item-lists" aria-labelledby="item-lists-heading" className="scroll-mt-6 space-y-5 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="item-lists-heading" className="text-xl font-semibold">リストに分類</h2><Link href={listHref(groupId)} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">リストを作成・管理</Link></div>
    <p className="text-sm text-stone-600">候補を複数のリストに入れられます。変更はメンバー全員に共有されます。</p>
    <form action={detailHref.split("?")[0]} method="get" role="search" className="flex flex-wrap items-end gap-3">
      {Array.from(new URLSearchParams(detailHref.split("?")[1]).entries()).filter(([key]) => key !== "listsQ" && key !== "listsPage").map(([key,value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <div className="min-w-0 flex-1 space-y-2"><label htmlFor="item-list-search" className="block text-sm font-semibold">リスト名で検索</label><input id="item-list-search" key={query} name="listsQ" type="search" defaultValue={query} className="min-h-12 w-full rounded-xl border border-stone-300 px-4 text-base" /></div>
      <button className="min-h-12 rounded-full bg-stone-900 px-5 font-semibold text-white">検索</button>
      {query && <Link href={`${sharedItemListsHref(detailHref,1)}#item-lists`} className="inline-flex min-h-12 items-center font-semibold text-orange-700 underline">条件を解除</Link>}
    </form>
    {invalid ? <p role="alert" className="text-sm text-red-700">検索語は100文字以内で入力してください。</p> : <>
      <p role="status" className="text-sm text-stone-600">{saved.total}件のリスト</p>
      {saved.lists.length ? <ul className="divide-y divide-stone-200">{saved.lists.map(list => <li key={list.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><span className="min-w-0 break-words font-semibold">{list.name}</span><ItemListButton groupId={groupId} itemId={itemId} listId={list.id} selected={list.is_selected} /></li>)}</ul> : <p className="text-sm text-stone-600">{page>1 ? "このページにリストはありません。" : query ? "条件に合うリストはありません。" : "リストはまだありません。先に作成してください。"}</p>}
      {(page>1 || page*LIST_PAGE_SIZE<saved.total) && <nav aria-label="候補のリストのページ" className="flex flex-wrap items-center gap-4 text-sm">{page>1 && <Link href={href(page-1)} className="min-h-11 font-semibold text-orange-700 underline">前のページ</Link>}<span>{page}ページ</span>{page*LIST_PAGE_SIZE<saved.total && <Link href={href(page+1)} className="min-h-11 font-semibold text-orange-700 underline">次のページ</Link>}</nav>}
    </>}
  </section>;
}
