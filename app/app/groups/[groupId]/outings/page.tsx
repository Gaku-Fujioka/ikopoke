import { Suspense } from "react";
import { TabLoading } from "@/components/layout/tab-loading";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getGroup } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { listOutings, OutingStoreError } from "@/lib/outings/repository";
import { OutingCard } from "@/components/home/collection-cards";
import { AuthSetupNotice } from "@/components/auth-setup-notice";

async function OutingsContent({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{status?:string}> }) {
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
  const status=(await searchParams).status;
  outings=outings.filter(o=>status==="cancelled"?Boolean(o.cancelled_at):!o.cancelled_at&&(status==="completed"?Boolean(o.completed_at):!o.completed_at));
  return <div className="space-y-6"><Link href={`/app/groups/${groupId}`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">← グループへ</Link><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-orange-700">{group.name}</p><h1 className="mt-2 text-3xl font-bold">みんなのおでかけ計画</h1><p className="mt-2 text-stone-600">日付、候補、参加者をグループで共有します。</p></div><Link href={`/app/groups/${groupId}/outings/new`} className="inline-flex min-h-12 items-center rounded-full bg-orange-700 px-6 font-semibold text-white">計画を作る</Link></div>
    <Link href={`/app/groups/${groupId}/outings/calendar`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">カレンダーで見る</Link>
    <nav className="kk-chips" aria-label="計画の状態"><Link className="kk-chip" href={`/app/groups/${groupId}/outings`}>計画中</Link><Link className="kk-chip" href={`/app/groups/${groupId}/outings?status=completed`}>終了済み</Link><Link className="kk-chip" href={`/app/groups/${groupId}/outings?status=cancelled`}>中止した計画</Link></nav>
    {outings.length ? <ul className="kk-collection-grid">{outings.map(outing => <li key={outing.id}><OutingCard outing={outing} groupName={group.name} /></li>)}</ul> : <p className="rounded-3xl border border-stone-200 bg-white p-6 text-stone-600">計画はまだありません。候補を選んで最初の計画を作りましょう。</p>}
  </div>;
}

export default function OutingsPage({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{status?:string}> }) {
  return <div className="mx-auto max-w-3xl"><Suspense fallback={<TabLoading label="おでかけ" />}><OutingsContent params={params} searchParams={searchParams} /></Suspense></div>;
}
