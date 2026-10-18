import { selectedCandidateIds, availableSelection } from "@/lib/outings/selection";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getGroup } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { getGroupMembers } from "@/lib/profiles/repository";
import { listCandidateOptions } from "@/lib/outings/repository";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { OutingForm } from "@/components/outings/outing-form";
import { isCalendarDate } from "@/lib/outings/calendar";

type Props = { params: Promise<{ groupId: string }>; searchParams: Promise<{ item?: string | string[]; date?: string | string[]; items?: string }> };
async function NewOutingContent({ params, searchParams }: Props) {
  const { groupId } = await params;
  if (!isGroupId(groupId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const search = await searchParams;
  const itemId = typeof search.item === "string" && isGroupId(search.item) ? search.item : undefined;
  const initialDate = isCalendarDate(search.date) ? search.date : undefined;
  const query = new URLSearchParams();
  if (search.items) query.set("items",selectedCandidateIds(search.items).join(","));
  if (itemId) query.set("item",itemId);
  if (initialDate) query.set("date",initialDate);
  const nextPath = `/app/groups/${groupId}/outings/new${query.size ? `?${query}` : ""}`;
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  let group, candidates, members;
  try {
    [group, candidates, members] = await Promise.all([getGroup(client,groupId),listCandidateOptions(client,groupId),getGroupMembers(client,groupId)]);
  } catch {
    return <p role="alert" className="rounded-3xl border bg-white p-6">計画の入力画面を読み込めませんでした。グループ画面から開き直してください。</p>;
  }
  if (!group) notFound();
  const selectedIds = selectedCandidateIds(search.items), validIds = availableSelection(selectedIds, candidates);
  return <div className="space-y-6"><Link href={`/app/groups/${groupId}/outings`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">← 計画一覧へ</Link><div><p className="text-sm font-semibold text-orange-700">{group.name}</p><h1 className="mt-2 text-3xl font-bold">おでかけ計画を作る</h1><p className="mt-2 text-stone-600">日程も、誰と行くかも、行き先も。全体を見ながら組み立てよう。</p></div>{validIds.length !== selectedIds.length && <p role="alert" className="kk-notice">アーカイブなどで追加できなくなった候補を除きました。行き先をご確認ください。</p>}<OutingForm groupId={groupId} outingId={randomUUID()} current={null} candidates={candidates} members={members} actorId={data.claims.sub} initialItemIds={validIds} initialItemId={itemId} initialDate={initialDate} /></div>;
}
export default function NewOutingPage(props: Props) {
  return <div className="mx-auto max-w-5xl"><Suspense fallback={<p role="status">計画の入力画面を読み込んでいます…</p>}><NewOutingContent {...props} /></Suspense></div>;
}
