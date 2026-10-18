import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getGroup } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { listOutings, OutingStoreError } from "@/lib/outings/repository";
import { OutingCard } from "@/components/home/collection-cards";
import { AuthSetupNotice } from "@/components/auth-setup-notice";

async function OutingsContent({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isGroupId(groupId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(`/app/groups/${groupId}/outings`)}`);
  let group, outings;
  try {
    [group, outings] = await Promise.all([getGroup(client,groupId),listOutings(client,groupId)]);
  } catch (cause) {
    return <p role="alert" className="rounded-3xl border bg-white p-6">{cause instanceof OutingStoreError ? cause.message : "計画を読み込めませんでした。もう一度お試しください。"}</p>;
  }
  if (!group) notFound();
  return <div className="space-y-6"><Link href={`/app/groups/${groupId}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">← グループへ</Link><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-orange-700">{group.name}</p><h1 className="mt-2 text-3xl font-bold">みんなのおでかけ計画</h1><p className="mt-2 text-stone-600">日付、候補、参加者をグループで共有します。</p></div><Link href={`/app/groups/${groupId}/outings/new`} className="inline-flex min-h-12 items-center rounded-full bg-orange-700 px-6 font-semibold text-white">計画を作る</Link></div>
    <Link href={`/app/groups/${groupId}/outings/calendar`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">カレンダーで見る</Link>
    {outings.length ? <ul className="kk-collection-grid">{outings.map(outing => <li key={outing.id}><OutingCard outing={outing} groupName={group.name} /></li>)}</ul> : <p className="rounded-3xl border border-stone-200 bg-white p-6 text-stone-600">計画はまだありません。候補を選んで最初の計画を作りましょう。</p>}
  </div>;
}

export default function OutingsPage({ params }: { params: Promise<{ groupId: string }> }) {
  return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status">計画を読み込んでいます…</p>}><OutingsContent params={params} /></Suspense></div>;
}
