import { hasEnvVars } from "@/lib/utils";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isGroupId } from "@/lib/groups/validation";
import { getGroup } from "@/lib/groups/repository";
import { listOutings, listCandidateOptions } from "@/lib/outings/repository";
import { selectedCandidateIds, availableSelection } from "@/lib/outings/selection";
import { dateDistance, shiftDay } from "@/lib/outings/trips";

async function Content({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{ items?: string }> }) {
  const { groupId } = await params, search = await searchParams;
  if (!isGroupId(groupId)) notFound();
  const ids = selectedCandidateIds(search.items), base = `/app/groups/${groupId}`;
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient(), auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(`${base}/outings/add?${new URLSearchParams({ items: ids.join(",") })}`)}`);
  let group, outings, candidates;
  try { [group, outings, candidates] = await Promise.all([getGroup(client, groupId), listOutings(client, groupId), listCandidateOptions(client, groupId)]); }
  catch { return <p role="alert" className="kk-notice">追加先を読み込めませんでした。候補一覧から開き直してください。</p>; }
  if (!group) notFound();
  const valid = availableSelection(ids, candidates), plans = outings.filter(o => !o.completed_at && !o.cancelled_at);
  return <div className="mx-auto max-w-3xl space-y-6"><Link href={`${base}/items`} className="kk-text-link">← 候補の選択に戻る</Link><div className="kk-page-heading"><p className="kk-eyebrow">{group.name}</p><h1>どのおでかけに加える？</h1><p>追加先の日を選び、計画画面で時間や順番を確認して保存します。</p></div>
    {valid.length !== ids.length && <p role="alert" className="kk-notice">アーカイブされた候補など、追加できない候補を除きました。</p>}
    {!valid.length ? <p className="kk-notice">追加できる候補がありません。候補一覧で選び直してください。</p> : <><div className="kk-selection-summary"><strong>選んだ行き先 · {valid.length}件</strong><p>{valid.map(id => candidates.find(c => c.id === id)?.title).join("、")}</p></div>
      {plans.map(plan => <form key={plan.id} action={`${base}/outings/${plan.id}/edit`} className="kk-surface space-y-4"><input type="hidden" name="items" value={valid.join(",")} /><input type="hidden" name="section" value="day" /><h2 className="text-xl font-bold">{plan.title}</h2><p className="kk-muted">{plan.outing_date} 〜 {plan.end_date}</p><label className="block space-y-2"><span className="font-semibold">追加先の日</span><select name="day" className="kk-field">{Array.from({ length: dateDistance(plan.outing_date, plan.end_date) + 1 }, (_, n) => <option key={n} value={n}>{n + 1}日目 · {shiftDay(plan.outing_date, n)}</option>)}</select></label><button className="kk-primary-link">この計画で追加内容を確認 →</button></form>)}
      {!plans.length && <p className="kk-muted">追加できる計画がありません。中止・終了済みの計画は、再開してから追加できます。</p>}<Link href={`${base}/outings/new?${new URLSearchParams({ items: valid.join(",") })}`} className="kk-secondary-link">新しい計画を作る</Link></>}
  </div>;
}
export default function AddCandidatesPage(props: Parameters<typeof Content>[0]) { return <Suspense fallback={<p role="status">追加先を探しています…</p>}><Content {...props} /></Suspense>; }
