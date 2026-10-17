import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getGroup } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { getGroupMembers } from "@/lib/profiles/repository";
import { getOuting, listCandidateOptions } from "@/lib/outings/repository";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { OutingForm } from "@/components/outings/outing-form";

async function OutingContent({ params }: { params: Promise<{ groupId: string; outingId: string }> }) {
  const { groupId, outingId } = await params;
  if (!isGroupId(groupId) || !isGroupId(outingId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(`/app/groups/${groupId}/outings/${outingId}`)}`);
  let group, current, candidates, members;
  try {
    [group, current, candidates, members] = await Promise.all([getGroup(client,groupId),getOuting(client,groupId,outingId),listCandidateOptions(client,groupId),getGroupMembers(client,groupId)]);
  } catch {
    return <p role="alert" className="rounded-3xl border bg-white p-6">計画を読み込めませんでした。計画一覧から開き直してください。</p>;
  }
  if (!group || !current) notFound();
  return <div className="space-y-6"><Link href={`/app/groups/${groupId}/outings`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">← 計画一覧へ</Link><div><p className="text-sm font-semibold text-orange-700">{group.name}</p><h1 className="mt-2 break-words text-3xl font-bold">{current.outing.title}</h1><p className="mt-2 text-stone-600">計画を編集できます。保存するとグループ全員に反映されます。</p></div><OutingForm key={current.outing.revision} groupId={groupId} outingId={outingId} current={current} candidates={candidates} members={members} actorId={data.claims.sub} /></div>;
}
export default function OutingPage({ params }: { params: Promise<{ groupId: string; outingId: string }> }) {
  return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status">計画を読み込んでいます…</p>}><OutingContent params={params} /></Suspense></div>;
}
