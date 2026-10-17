import { randomUUID } from "node:crypto";
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
import { CreateItemForm } from "@/components/items/create-item-form";
import { RetryItems } from "@/components/items/retry-items";

type Props = { params: Promise<{ groupId: string }>; searchParams: Promise<{ page?: string | string[] }> };

async function ItemsContent({ params, searchParams }: Props) {
  const { groupId } = await params;
  if (!isGroupId(groupId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const page = itemPage((await searchParams).page);
  const listPath = `/app/groups/${groupId}/items`;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(`${listPath}?page=${page}`)}`);
  let group;
  let saved;
  try {
    group = await getGroup(client, groupId);
    if (group) saved = await listItems(client, groupId, page);
  } catch (cause) {
    return (
      <div role="alert" className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6">
        <p>{cause instanceof GroupStoreError || cause instanceof ItemStoreError ? cause.message : "候補を読み込めませんでした。もう一度お試しください。"}</p>
        <RetryItems />
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
          <p className="mt-3 text-sm leading-6 text-stone-600">このグループのメンバーに共有されます。新しい順に表示しています。</p>
        </div>
        <a href="#add-item" className="inline-flex min-h-11 items-center rounded-full bg-orange-700 px-6 text-sm font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">候補を追加</a>
      </div>
      <section aria-label="保存した候補" className="space-y-4">
        <p className="text-sm text-stone-600">全{saved.total}件</p>
        {saved.items.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {saved.items.map((item) => (
              <li key={item.id} className="min-w-0">
                <Link href={`${listPath}/${item.id}?page=${page}`} className="block h-full rounded-3xl border border-stone-200 bg-white p-6 hover:border-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">
                  <span className="text-xs font-semibold text-orange-700">{item.kind === "spot" ? "スポット" : "やりたいこと"}</span>
                  <h2 className="mt-3 break-words text-xl font-semibold">{item.title}</h2>
                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-stone-600">{item.memo || "メモはまだありません。"}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-3xl border border-stone-200 bg-white p-6">
            <h2 className="text-xl font-semibold">{page === 1 ? "候補がまだありません" : "このページには候補がありません"}</h2>
            <p className="mt-2 leading-7 text-stone-600">{page === 1 ? "気になる場所や、やりたいことを一つ追加しましょう。" : "最初のページから候補をご確認ください。"}</p>
            {page > 1 && <Link href={listPath} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">最初のページへ</Link>}
          </div>
        )}
        {(page > 1 || page * ITEM_PAGE_SIZE < saved.total) && (
          <nav aria-label="候補一覧のページ" className="flex flex-wrap items-center gap-5">
            {page > 1 && <Link href={`${listPath}?page=${page - 1}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">前のページ</Link>}
            <span className="text-sm text-stone-600">{page}ページ</span>
            {page * ITEM_PAGE_SIZE < saved.total && <Link href={`${listPath}?page=${page + 1}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">次のページ</Link>}
          </nav>
        )}
      </section>
      <CreateItemForm groupId={groupId} groupName={group.name} requestId={randomUUID()} />
    </div>
  );
}

export default function SharedItemsPage(props: Props) {
  return <Suspense fallback={<p role="status">候補を読み込んでいます…</p>}>
    <ItemsContent {...props} />
  </Suspense>;
}
