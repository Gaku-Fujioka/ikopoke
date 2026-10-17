import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { isGroupId } from "@/lib/groups/validation";
import { getGroup, GroupStoreError } from "@/lib/groups/repository";
import { listLists, ListStoreError } from "@/lib/lists/repository";
import { LIST_PAGE_SIZE, listHref, listQuery, validListQuery } from "@/lib/lists/validation";
import { itemPage } from "@/lib/items/validation";
import { sharedItemListHref } from "@/lib/items/search";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { CreateListForm, ManageListForm } from "@/components/lists/list-forms";
import { RetryItems } from "@/components/items/retry-items";

type Props = { params: Promise<{ groupId: string }>; searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> };

async function ListsContent({ params, searchParams }: Props) {
  const { groupId } = await params;
  if (!isGroupId(groupId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const search = await searchParams, query = listQuery(search.q), page = itemPage(search.page);
  const invalid = !validListQuery(query), path = listHref(groupId, query, page);
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(path)}`);
  let group, saved;
  try { [group, saved] = await Promise.all([getGroup(client, groupId), invalid ? Promise.resolve({ lists: [], total: 0 }) : listLists(client, groupId, page, query)]); }
  catch (cause) { return <div role="alert" className="space-y-3 rounded-3xl bg-white p-6"><p>{cause instanceof GroupStoreError || cause instanceof ListStoreError ? cause.message : "リストを読み込めませんでした。"}</p><RetryItems /><Link href={`/app/groups/${groupId}`} className="underline">グループへ</Link></div>; }
  if (!group || !saved) notFound();
  return <div className="mx-auto max-w-3xl space-y-6">
    <Link href={`/app/groups/${groupId}/items`} className="inline-flex min-h-11 items-center font-semibold text-stone-600 underline underline-offset-4">← みんなの候補へ</Link>
    <header><p className="break-words text-sm font-semibold text-orange-700">{group.name}</p><h1 className="mt-2 text-3xl font-bold">リスト管理</h1><p className="mt-2 text-sm leading-6 text-stone-600">メンバー全員がリストを管理できます。1つの候補を複数リストに入れられます。</p></header>
    <CreateListForm groupId={groupId} initialRequestId={randomUUID()} />
    <form action={`/app/groups/${groupId}/lists`} method="get" role="search" className="flex flex-wrap items-end gap-3 rounded-3xl border border-stone-200 bg-white p-5">
      <div className="min-w-0 flex-1 space-y-2"><label htmlFor="list-search" className="block text-sm font-semibold">リスト名で検索</label><input id="list-search" key={query} name="q" type="search" defaultValue={query} placeholder="名前の一部を入力" aria-invalid={invalid} className="min-h-12 w-full rounded-xl border border-stone-300 px-4 text-base" /></div>
      <button className="min-h-12 rounded-full bg-stone-900 px-6 font-semibold text-white">検索</button>
      {query && <Link href={listHref(groupId)} className="inline-flex min-h-12 items-center font-semibold text-orange-700 underline">条件を解除</Link>}
      {invalid && <p role="alert" className="w-full text-sm text-red-700">検索語は100文字以内で入力してください。</p>}
    </form>
    {!invalid && <section aria-label="リスト一覧" className="space-y-4">
      <p role="status" className="text-sm text-stone-600">{query ? `「${query}」の検索結果：${saved.total}件` : `全${saved.total}件`}</p>
      {saved.lists.length ? <ul className="space-y-4">{saved.lists.map(list => <li key={list.id} className="space-y-4 rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="break-words text-xl font-semibold">{list.name}</h2>
        <Link href={sharedItemListHref(groupId,"",1,{list:list.id})} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">このリストの候補を見る</Link>
        <ManageListForm groupId={groupId} listId={list.id} initialName={list.name} />
      </li>)}</ul> : <p className="rounded-3xl border border-stone-200 bg-white p-6 text-stone-600">{page>1 ? "このページにリストはありません。" : query ? "条件に合うリストはありません。" : "リストはまだありません。上から作成できます。"}</p>}
      {(page>1 || page*LIST_PAGE_SIZE<saved.total) && <nav aria-label="リストのページ" className="flex flex-wrap items-center gap-4 text-sm">{page>1 && <Link href={listHref(groupId,query,page-1)} className="min-h-11 font-semibold text-orange-700 underline">前のページ</Link>}<span>{page}ページ</span>{page*LIST_PAGE_SIZE<saved.total && <Link href={listHref(groupId,query,page+1)} className="min-h-11 font-semibold text-orange-700 underline">次のページ</Link>}</nav>}
    </section>}
  </div>;
}

export default function ListsPage(props: Props) { return <Suspense fallback={<p role="status">リストを読み込んでいます…</p>}><ListsContent {...props} /></Suspense>; }
