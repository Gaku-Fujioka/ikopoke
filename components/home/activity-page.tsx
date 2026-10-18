import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { listGroups } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { getActivity, type ActivityCursor } from "@/lib/home/repository";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { ActivityCards } from "./activity-cards";
import { HomeError } from "./shared-home";
import { RefreshButton } from "./refresh-button";

export type ActivitySearch = { at?: string; key?: string };
export async function ActivityPageContent({ groupId = null, searchParams }: { groupId?: string | null; searchParams: Promise<ActivitySearch> }) {
  if (groupId && !isGroupId(groupId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const search = await searchParams;
  const base = groupId ? `/app/groups/${groupId}` : "/app";
  const path = `${base}/activity`;
  const client = await createClient(), { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(path)}`);
  let groups;
  try { groups = await listGroups(client); } catch { return <HomeError />; }
  if (groupId && !groups.some(group => group.id === groupId)) notFound();
  let cursor: ActivityCursor | undefined;
  if (search.at !== undefined || search.key !== undefined) {
    if (typeof search.at !== "string" || search.at.length > 40 || !Number.isFinite(Date.parse(search.at)) || typeof search.key !== "string" || !/^[a-f0-9]{32}$/.test(search.key)) return <div className="kk-notice"><p role="alert">ページの指定を読み取れませんでした。</p><Link className="kk-text-link" href={path}>最新の近況へ</Link></div>;
    cursor = { at: search.at, key: search.key };
  }
  let entries;
  try { entries = await getActivity(client, groupId, 21, cursor); } catch { return <HomeError />; }
  const page = entries.slice(0, 20), last = page.at(-1);
  return <div className="kk-collection"><Link href={base} className="kk-text-link self-start">← ホームへ</Link><div className="kk-row"><div className="kk-page-heading"><p className="kk-eyebrow">{groupId ? groups.find(group => group.id === groupId)?.name : "すべてのグループ"}</p><h1>こんな動きがあった！</h1></div><RefreshButton /></div><p className="kk-muted">最近の追加・コメント・現在の反応を、新しい順に。反応は変更後の内容を表示し、取り消すと消えます。日本時間で表示します。</p>
    {page.length ? <ActivityCards entries={page} groups={groups} expanded /> : <div className="kk-empty"><h2>{cursor ? "ここまでの近況を見ました" : "これから一緒に育てよう"}</h2><p>候補を追加したり、反応したりするとここに集まります。</p></div>}
    <nav className="kk-pager" aria-label="近況のページ">{cursor ? <Link href={path} className="kk-text-link">最新の近況へ</Link> : <span />}{entries.length > 20 && last && <Link href={`${path}?${new URLSearchParams({ at: last.occurred_at, key: last.event_key })}`} className="kk-text-link">前の近況を見る →</Link>}</nav>
  </div>;
}
