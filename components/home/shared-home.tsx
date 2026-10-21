import type {CSSProperties} from "react";
import {groupColorStyle} from "@/lib/presentation/colors";
import { CandidateBoard } from "@/components/items/candidate-board";
import { listItems } from "@/lib/items/repository";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Home, MapPin, Search, Sparkles } from "lucide-react";
import { SearchWorkspace } from "@/components/maps/search-workspace";
import { SavedMapSection } from "@/components/maps/map-sections";
import { mapsConfig } from "@/lib/maps/saved";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { listGroups, type SavedGroup } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { getActivity, HomeStoreError, nextOuting, recentCandidates, type HomeClient } from "@/lib/home/repository";
import { addHref, collectionHref, groupTone, prettyDate } from "@/lib/home/navigation";
import { japanCalendarToday } from "@/lib/outings/calendar";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { GroupCards } from "./group-cards";
import { ActivityCards } from "./activity-cards";
import { RefreshButton } from "./refresh-button";
import {ProfileImage} from "@/components/profiles/profile-image";

export function HomeError({ message = "読み込めませんでした。更新してもう一度お試しください。" }: { message?: string }) {
  return <div role="alert" className="kk-notice"><p>{message}</p><RefreshButton /></div>;
}
export function HomeLoading({ children }: { children: string }) {
  return <p role="status" className="kk-loading">{children}</p>;
}
async function NextEnjoyment({ client, groupId, groups }: { client: HomeClient; groupId: string | null; groups: SavedGroup[] }) {
  let outing;
  const today = japanCalendarToday(new Date());
  try { outing = await nextOuting(client, groupId, today); } catch { return <HomeError message="次のおでかけを読み込めませんでした。おでかけタブからも確認できます。" />; }
  if (!outing) return <section aria-labelledby="next-enjoyment" className="kk-next-empty"><span className="kk-option-icon"><CalendarDays aria-hidden="true" /></span><div><h2 id="next-enjoyment">次の楽しみをつくろう</h2><p>ためていた行きたいを、ひとつの予定に。</p><Link className="kk-text-link" href={addHref("outing", groupId)}>おでかけを計画する <ArrowRight size={15} aria-hidden="true" /></Link></div></section>;
  const days = Math.round((Date.parse(`${outing.outing_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return <section aria-labelledby="next-enjoyment"><Link href={`/app/groups/${outing.group_id}/outings/${outing.id}`} className={`kk-next${days <= 3 ? " kk-next-soon" : ""}`}>
    <span className="kk-date-block"><span>{Number(outing.outing_date.slice(5, 7))}月</span><strong>{Number(outing.outing_date.slice(8, 10))}</strong></span>
    <div><p className="kk-next-label">{days < 0 ? "旅のまっただ中！" : days === 0 ? "今日のおでかけ！" : days === 1 ? "明日が、たのしみ！" : days <= 3 ? `あと${days}日、もうすぐ！` : "次の楽しみ"}</p><h2 id="next-enjoyment">{outing.title}</h2><p className="kk-next-meta">{groups.find(group => group.id === outing.group_id)?.name} · <time dateTime={outing.outing_date}>{prettyDate(outing.outing_date)}</time>{outing.end_date && outing.end_date !== outing.outing_date && <>〜<time dateTime={outing.end_date}>{prettyDate(outing.end_date)}</time></>}</p></div><ArrowRight aria-hidden="true" size={20} />
  </Link></section>;
}
async function SavedPeek({ client, groupId, groups }: { client: HomeClient; groupId: string | null; groups: SavedGroup[] }) {
  let items;
  try { items = await recentCandidates(client, groupId); } catch { return <p role="alert" className="kk-map-note">候補を読み込めませんでした。「行きたい」タブから開き直してください。</p>; }
  if (!items.length) return <p className="kk-map-note">気になる場所を見つけたら、まずは名前だけでも。</p>;
  return <ul className="kk-saved-peek">{items.map(item => <li key={item.id}><Link href={`/app/groups/${item.group_id}/items/${item.id}`} style={groupColorStyle(groups.find(group=>group.id===item.group_id)?.presentation?.color) as CSSProperties} data-tone={groupTone(item.group_id)}><MapPin aria-hidden="true" size={15} /><span>{item.title}</span><ArrowRight aria-hidden="true" size={14} /></Link></li>)}</ul>;
}
function MapSpace({ client, groupId, groups }: { client: HomeClient; groupId: string | null; groups: SavedGroup[] }) {
  return <section className="kk-map-card" aria-labelledby="home-map-title" data-home-section="map">
    <div className="kk-map-top"><h2 id="home-map-title"><MapPin aria-hidden="true" size={17} />行きたいが、ひろがる</h2><span className="kk-label">ここから、次の行き先へ</span></div>
    <SearchWorkspace groups={groups} groupId={groupId ?? undefined} config={mapsConfig()} />
    <Suspense fallback={<HomeLoading>保存した場所を読み込んでいます…</HomeLoading>}><SavedMapSection client={client} groupId={groupId} groups={groups} /></Suspense>
    <details className="kk-saved-search"><summary>保存した候補から探す</summary><p>みんなが追加した候補を、名前で絞り込みます。</p>
      <form action={collectionHref("items", groupId)} role="search" aria-label="保存した候補を検索" className="kk-map-search"><Search aria-hidden="true" size={18} /><label htmlFor="home-candidate-search" className="sr-only">保存した候補を名前で検索</label><input id="home-candidate-search" type="search" name="q" maxLength={100} placeholder="保存した候補の名前" /><button type="submit">候補を検索</button></form>
      <Suspense fallback={<HomeLoading>保存した候補を読み込んでいます…</HomeLoading>}><SavedPeek client={client} groupId={groupId} groups={groups} /></Suspense>
    </details>
  </section>;
}
async function RecentActivity({ client, groupId, groups }: { client: HomeClient; groupId: string | null; groups: SavedGroup[] }) {
  let entries;
  try { entries = await getActivity(client, groupId); } catch (cause) { return <HomeError message={cause instanceof HomeStoreError ? cause.message : undefined} />; }
  return <>
    {entries.length ? <ActivityCards entries={entries.slice(0, 12)} groups={groups} /> : <div className="kk-empty"><Sparkles aria-hidden="true" /><h3>ここから、ワイワイ。</h3><p>候補を追加したり反応したりすると、<br />みんなの動きがここに集まります。</p><Link href={addHref("item", groupId)} className="kk-text-link">最初の行きたいを残す →</Link></div>}
    {entries.length > 0 && <Link href={groupId ? `/app/groups/${groupId}/activity` : "/app/activity"} className="kk-feed-more">近況を一覧で見る <ArrowRight aria-hidden="true" size={15} /></Link>}
  </>;
}

async function GroupCandidates({ client, groupId }: { client: HomeClient; groupId: string }) {
  try {
    const saved = await listItems(client, groupId, 1, "", { sort: "recommended" });
    return saved.items.length ? <CandidateBoard key={groupId} groupId={groupId} items={saved.items.slice(0,4)} links={Object.fromEntries(saved.items.slice(0,4).map(item => [item.id, '/app/groups/'+groupId+'/items/'+item.id]))} /> : <div className="kk-empty"><h3>最初の「ここ、行ってみない？」を。</h3><p>気になる場所をためたら、みんなで選んで計画へ。</p><Link href={'/app/groups/'+groupId+'/items/new'} className="kk-primary-link">最初の候補を追加</Link></div>;
  } catch { return <HomeError message="候補を読み込めませんでした。行きたいタブからも確認できます。" />; }
}
async function GroupConversations({ client, groupId, groups }: { client: HomeClient; groupId: string; groups: SavedGroup[] }) {
  try {
    const entries = (await getActivity(client,groupId,30)).filter(entry=>['comment','want_to_go','not_now'].includes(entry.kind)).slice(0,6);
    return entries.length ? <ActivityCards entries={entries} groups={groups} /> : <p className="kk-muted">候補への気持ちやコメントが、ここに集まります。気になる候補から声をかけてみよう。</p>;
  } catch { return <HomeError message="最近の会話と反応を読み込めませんでした。" />; }
}

export async function SharedHome({ groupId = null }: { groupId?: string | null }) {
  if (groupId && !isGroupId(groupId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const path = groupId ? `/app/groups/${groupId}` : "/app";
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(path)}`);
  let groups;
  try { groups = await listGroups(client); } catch { return <HomeError message="グループを読み込めませんでした。更新してもう一度お試しください。" />; }
  if (groupId && !groups.some(group => group.id === groupId)) notFound();
  if (groupId) {
    const group = groups.find(group=>group.id===groupId)!;
    const base = '/app/groups/'+groupId;
    return <div className="space-y-8">
      <Link href="/app" className="kk-global-home-link"><ArrowLeft size={18} aria-hidden="true"/><Home size={18} aria-hidden="true"/><span>全体ホームへ<small>すべてのグループを見る</small></span></Link>
      <header className="kk-group-header"><div>{group.presentation?.cover_path&&<ProfileImage path={group.presentation.cover_path} alt="" className="kk-group-hero-photo"/>}<p className="kk-eyebrow">わたしたちの、おでかけ帳</p><h1>{group.name}</h1><p className="whitespace-pre-wrap">{group.presentation?.description||"行きたいを持ち寄って、次の楽しみへ。"}</p></div><Link href={base+'/settings'} className="kk-secondary-link">メンバー・設定</Link></header>
      <div className="kk-group-launch"><Link href={base+'/items/new'}><span aria-hidden="true">＋</span><strong>行きたいを追加</strong><small>名前だけでも、ひとつのきっかけ</small></Link><Link href={base+'/outings/new'}><CalendarDays aria-hidden="true" /><strong>おでかけを計画</strong><small>日程と行き先を、一緒に決めよう</small></Link></div>
      <Suspense fallback={<HomeLoading>次の楽しみを読み込んでいます…</HomeLoading>}><NextEnjoyment client={client} groupId={groupId} groups={groups} /></Suspense>
      <section aria-labelledby="group-candidates"><div className="kk-section-heading"><div><p className="kk-eyebrow">気持ちが集まったら、出かけよう</p><h2 id="group-candidates">みんなの行きたい</h2></div><div className="flex flex-wrap gap-3"><Link href={base+'/lists'} className="kk-secondary-link">▤ リストで探す</Link><Link href={base+'/items'} className="kk-text-link">すべて見る →</Link></div></div><Suspense fallback={<HomeLoading>候補を読み込んでいます…</HomeLoading>}><GroupCandidates client={client} groupId={groupId} /></Suspense></section>
      <section aria-labelledby="group-conversations" className="kk-conversation-space"><div className="kk-section-heading"><div><p className="kk-eyebrow">ひとことから、楽しみがふくらむ</p><h2 id="group-conversations">最近の会話と反応</h2></div><RefreshButton /></div><Suspense fallback={<HomeLoading>会話と反応を読み込んでいます…</HomeLoading>}><GroupConversations client={client} groupId={groupId} groups={groups} /></Suspense><Link href={base+'/activity'} className="kk-text-link">グループの近況をすべて見る →</Link></section>
      <MapSpace client={client} groupId={groupId} groups={groups} />
      <nav aria-label="グループのおでかけ帳" className="kk-group-shortcuts"><Link href={base+'/outings'}>おでかけ一覧 <ArrowRight size={16} aria-hidden="true" /></Link><Link href={base+'/memories'}>思い出をひらく <ArrowRight size={16} aria-hidden="true" /></Link><Link href={base+'/lists'}>リストで整理 <ArrowRight size={16} aria-hidden="true" /></Link><Link href={base+'/visits'}>行った！の記録 <ArrowRight size={16} aria-hidden="true" /></Link></nav>
    </div>;
  }
  return <div className="kk-home">
    <div className="kk-hero" data-home-section="intro"><p className="kk-eyebrow">行きたいから、思い出まで。</p><h1>次は、どこいこ？<span aria-hidden="true">✦</span></h1><p>みんなの「いいね」が、次の楽しみに。</p></div>
    <GroupCards groups={groups} selected={groupId} />
    {groups.length ? <>
      <div data-home-section="next"><Suspense fallback={<HomeLoading>次の楽しみを読み込んでいます…</HomeLoading>}><NextEnjoyment client={client} groupId={groupId} groups={groups} /></Suspense></div>
      <MapSpace client={client} groupId={groupId} groups={groups} />
      <section aria-labelledby="home-activity-title" data-home-section="activity"><div className="kk-row"><div><p className="kk-eyebrow">みんなで育つ、おでかけ帳</p><h2 id="home-activity-title">こんな動きがあった！</h2></div><RefreshButton /></div><p className="kk-muted kk-feed-help">{groupId ? "このグループ" : "全グループ"}の最近の追加と現在の反応 · 日本時間</p><Suspense fallback={<HomeLoading>みんなの動きを読み込んでいます…</HomeLoading>}><RecentActivity client={client} groupId={groupId} groups={groups} /></Suspense></section>
    </> : <div className="kk-welcome"><Sparkles aria-hidden="true" size={30} /><h2>最初のグループから、はじめよう。</h2><p>ひとりで候補をためても、あとから誰かを招待しても。<br />行きたいを一緒に育てる場所です。</p><Link href="/app/groups#new-group" className="kk-primary-link">グループを作る <ArrowRight aria-hidden="true" size={17} /></Link></div>}
  </div>;
}
