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

type Props = { params: Promise<{ groupId: string; itemId: string }>; searchParams: Promise<{ page?: string | string[] }> };

async function ItemContent({ params, searchParams }: Props) {
  const { groupId, itemId } = await params;
  if (!isGroupId(groupId) || !isGroupId(itemId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const listPath = `/app/groups/${groupId}/items`;
  const page = itemPage((await searchParams).page);
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(`${listPath}/${itemId}?page=${page}`)}`);
  let group;
  let item;
  try {
    group = await getGroup(client, groupId);
    if (group) item = await getItem(client, groupId, itemId);
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
      <Link href={`${listPath}?page=${page}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-stone-600 underline underline-offset-4">← みんなの候補へ</Link>
      <article className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
        <p className="break-words text-sm font-semibold text-orange-700">{group.name} / {item.kind === "spot" ? "スポット" : "やりたいこと"}</p>
        <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{item.title}</h1>
        <p className="text-sm leading-6 text-stone-600">このグループのメンバーに共有されています。</p>
        <section aria-labelledby="item-memo-heading" className="border-t border-stone-200 pt-5">
          <h2 id="item-memo-heading" className="font-semibold">メモ</h2>
          <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-stone-700">{item.memo || "メモはまだありません。"}</p>
        </section>
      </article>
    </div>
  );
}

export default function SharedItemPage(props: Props) {
  return <Suspense fallback={<p role="status">候補を読み込んでいます…</p>}>
    <ItemContent {...props} />
  </Suspense>;
}
