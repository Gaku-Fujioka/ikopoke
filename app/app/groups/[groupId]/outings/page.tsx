import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getGroup } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { listOutings, OutingStoreError } from "@/lib/outings/repository";
import { OUTING_MODES } from "@/lib/outings/validation";
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
    {outings.length ? <ul className="grid gap-4 sm:grid-cols-2">{outings.map(outing => <li key={outing.id}><Link href={`/app/groups/${groupId}/outings/${outing.id}`} className="block h-full rounded-3xl border border-stone-200 bg-white p-6 hover:border-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"><p className="text-sm font-semibold text-orange-700">{outing.outing_date} · {OUTING_MODES.find(mode => mode.value === outing.mode)?.label}</p><h2 className="mt-2 break-words text-xl font-bold">{outing.title}</h2><p className="mt-3 text-sm font-semibold text-orange-700">計画を開く →</p></Link></li>)}</ul> : <p className="rounded-3xl border border-stone-200 bg-white p-6 text-stone-600">計画はまだありません。候補を選んで最初の計画を作りましょう。</p>}
  </div>;
}

export default function OutingsPage({ params }: { params: Promise<{ groupId: string }> }) {
  return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status">計画を読み込んでいます…</p>}><OutingsContent params={params} /></Suspense></div>;
}
