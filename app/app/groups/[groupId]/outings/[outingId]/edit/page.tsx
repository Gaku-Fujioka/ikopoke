import { hasEnvVars } from "@/lib/utils";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isGroupId } from "@/lib/groups/validation";
import { getGroup } from "@/lib/groups/repository";
import { getGroupMembers } from "@/lib/profiles/repository";
import { getOuting, listCandidateOptions } from "@/lib/outings/repository";
import { availableSelection, selectedCandidateIds } from "@/lib/outings/selection";
import { OutingForm, type OutingEditSection } from "@/components/outings/outing-form";

const labels = { all: "計画を編集", title: "計画名を編集", dates: "旅行の日程を変更", memo: "計画のメモを編集", participants: "参加者を変更", day: "行き先・順番・時間を編集" };
async function Content({ params, searchParams }: { params: Promise<{ groupId: string; outingId: string }>; searchParams: Promise<{ section?: string; day?: string; items?: string }> }) {
  const { groupId, outingId } = await params, search = await searchParams;
  if (!isGroupId(groupId) || !isGroupId(outingId)) notFound();
  const section: OutingEditSection = Object.hasOwn(labels, search.section ?? "") ? search.section as OutingEditSection : "all";
  const base = `/app/groups/${groupId}/outings/${outingId}`, ids = selectedCandidateIds(search.items);
  const query = new URLSearchParams({ section, day: search.day ?? "0", items: ids.join(",") });
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient(), auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(`${base}/edit?${query}`)}`);
  let group, current, candidates, members;
  try { [group, current, candidates, members] = await Promise.all([getGroup(client, groupId), getOuting(client, groupId, outingId), listCandidateOptions(client, groupId), getGroupMembers(client, groupId)]); }
  catch { return <p role="alert" className="kk-notice">編集画面を読み込めませんでした。計画から開き直してください。</p>; }
  if (!group || !current) notFound();
  if (current.outing.completed_at || current.outing.cancelled_at) return <div className="space-y-4"><p className="kk-notice">中止・終了済みの計画は、再開してから編集できます。</p><Link href={base} className="kk-text-link">計画に戻る →</Link></div>;
  const valid = availableSelection(ids, candidates), rawDay = Number(search.day), initialDay = Number.isInteger(rawDay) && rawDay >= 0 && rawDay < current.days.length ? rawDay : 0;
  return <div className="mx-auto max-w-5xl space-y-6"><Link href={base} className="kk-text-link">← 計画に戻る</Link><div className="kk-page-heading"><p className="kk-eyebrow">{group.name} · {current.outing.title}</p><h1>{labels[section]}</h1><p>保存すると、みんなの計画に反映されます。</p></div>
    {ids.length !== valid.length && <p role="alert" className="kk-notice">追加できない候補がありました。候補の状態をご確認ください。</p>}
    <OutingForm key={current.outing.revision} groupId={groupId} outingId={outingId} current={current} candidates={candidates} members={members} actorId={auth.data.claims.sub} section={valid.length ? "day" : section} initialDay={initialDay} initialItemIds={valid} draftId={randomUUID()} />
  </div>;
}
export default function EditOutingPage(props: Parameters<typeof Content>[0]) { return <Suspense fallback={<p role="status">編集画面を読み込んでいます…</p>}><Content {...props} /></Suspense>; }
