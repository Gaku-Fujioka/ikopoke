import type {CSSProperties} from "react";
import {groupColorStyle} from "@/lib/presentation/colors";
import { ItemExtraFilters } from "@/components/items/item-extra-filters";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { listGroups } from "@/lib/groups/repository";
import { globalItems, globalMemories, globalOutings } from "@/lib/home/repository";
import { addHref, groupTone, pageNumber, type Collection } from "@/lib/home/navigation";
import { itemSearchQuery, validItemSearch, itemFilters, appendItemFilters } from "@/lib/items/search";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { CandidateCard, MemoryCard, OutingCard } from "./collection-cards";
import { HomeError } from "./shared-home";
import {PocketMark} from "@/components/brand/pocket-mark";
import {MemoryNavigation} from "@/components/memories/memory-navigation";
import {VisitTimeline} from "@/components/visits/visit-timeline";
import {listVisitSummaries} from "@/lib/visits/repository";

export type CollectionSearch = { page?: string | string[]; q?: string | string[]; kind?: string | string[]; status?: string | string[]; archived?: string; visited?: string; priority?: string; sort?: string;view?:string|string[] };
const headings = {
  items: { title: "みんなの行きたい", eyebrow: "みんなの、行きたいポケット", description: "気になる場所も、やってみたいことも。", empty: "ポケットに、最初の「行きたい」を。" },
  outings: { title: "おでかけ", eyebrow: "次の楽しみを、一緒に", description: "ためていた行きたいを、カレンダーの楽しみに。", empty: "次は、いつ会おう？" },
  memories: { title: "みんなの思い出", eyebrow: "楽しかった日が、一冊に", description: "一緒に過ごした日を、何度でも。", empty: "これから増える、思い出たち。" },
};
export async function GlobalCollection({ type, searchParams }: { type: Collection; searchParams: Promise<CollectionSearch> }) {
  if (!hasEnvVars) return <AuthSetupNotice />;
  const search = await searchParams, page = pageNumber(search.page), text = itemSearchQuery(search.q);
  const kind = search.kind === "spot" || search.kind === "activity" ? search.kind : "";
  const filters = itemFilters(search);
  const cancelled = search.status === "cancelled";
  const completed = search.status === "completed";
  const query = new URLSearchParams();
  const showVisits=type==="memories"&&search.view==="visits";
  if(showVisits)query.set("view","visits");
  if (text && type === "items") query.set("q", text);
  if (kind && type === "items") query.set("kind", kind);
  if (completed && type === "outings") query.set("status", "completed");
  if (type === "items") appendItemFilters(query, filters);
  if (cancelled && type === "outings") query.set("status", "cancelled");
  const href = (nextPage = 1) => { const p = new URLSearchParams(query); if (nextPage > 1) p.set("page", String(nextPage)); return `/app/${type}${p.size ? `?${p}` : ""}`; };
  const client = await createClient(), { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(href(page))}`);
  let groups;
  try { groups = await listGroups(client); } catch { return <HomeError />; }
  const groupName = (id: string) => groups.find(group => group.id === id)?.name ?? "グループ";
  const groupColor = (id: string) => groups.find(group => group.id === id)?.presentation?.color;
  const heading = headings[type];
  const invalidSearch = type === "items" && !validItemSearch(text);
  let items, outings, visits, memories, failed = false;
  try {
    if (!invalidSearch) {
      if (type === "items") items = await globalItems(client, page, text, kind, filters);
      else if (type === "outings") outings = await globalOutings(client, page, completed, cancelled);
      else if (showVisits) visits = await listVisitSummaries(client, null, page);
      else memories = await globalMemories(client, page);
    }
  } catch { failed = true; }
  let body, total = 0;
  if (failed) body = <HomeError />;
  else if (invalidSearch) body = <p role="alert" className="kk-notice">検索語は100文字以内で入力してください。</p>;
  else if (items) {
    total = items.total;
    body = items.rows.length ? <ul className="kk-collection-grid">{items.rows.map(item => <li key={item.id}><CandidateCard item={item} groupName={groupName(item.group_id)} groupColor={groupColor(item.group_id)} href={`/app/groups/${item.group_id}/items/${item.id}?${new URLSearchParams({ ...Object.fromEntries(query), origin: "all", page: String(page) })}`} /></li>)}</ul> : null;
  } else if (outings) {
    total = outings.total;
    body = outings.rows.length ? <ul className="kk-collection-grid">{outings.rows.map(outing => <li key={outing.id}><OutingCard outing={outing} groupName={groupName(outing.group_id)} groupColor={groupColor(outing.group_id)} /></li>)}</ul> : null;
  } else if (visits) {
    total = visits.total;
    body = visits.visits.length ? <VisitTimeline visits={visits.visits} groups={groups} photosUnavailable={visits.photosUnavailable} /> : null;
  } else if (memories) {
    total = memories.total;
    body = memories.rows.length ? <ul className="kk-collection-grid">{memories.rows.map(memory => <li key={memory.id}><MemoryCard memory={memory} groupName={groupName(memory.group_id)} groupColor={groupColor(memory.group_id)} /></li>)}</ul> : null;
  }
  return <div className="kk-collection">
    <div className="kk-page-heading"><p className="kk-eyebrow">{showVisits?"日々の「行った！」を、思い出に":heading.eyebrow}</p><h1>{showVisits?"みんなの訪問記録":heading.title}</h1><p>{heading.description}</p></div>
    <nav aria-label="表示するグループ" className="kk-chips"><Link href={href()} className="kk-chip" aria-current="page">すべてのグループ</Link>{groups.map(group => <Link href={`/app/groups/${group.id}/${showVisits?"visits":type}${type === "items" && query.size ? `?${query}` : ""}`} key={group.id} style={groupColorStyle(group.presentation?.color) as CSSProperties} data-tone={groupTone(group.id)} className="kk-chip kk-personal-chip">{group.name}</Link>)}</nav>
    {type==="memories"&&<MemoryNavigation active={showVisits?"visits":"albums"}/>}
    {type === "items" && <div className="kk-pocket-intro"><PocketMark/><p><strong>見つけた「行きたい」を、ポケットへ。</strong><span>気になる場所も、やってみたいことも。ためた候補から、次のおでかけを選ぼう。</span></p></div>}
    {type === "items" && <form action="/app/items" role="search" className="kk-surface flex flex-wrap items-end gap-3"><div className="flex-1 basis-40"><label htmlFor="all-items-q" className="mb-2 block text-xs font-semibold">候補の名前</label><input key={text} id="all-items-q" type="search" name="q" defaultValue={text} placeholder="名前の一部を入力" className="min-h-12 w-full rounded-xl border bg-white px-3 text-base" /></div><div><label htmlFor="all-items-kind" className="mb-2 block text-xs font-semibold">種類</label><select key={kind} id="all-items-kind" name="kind" defaultValue={kind} className="min-h-12 rounded-xl border bg-white px-3 text-base"><option value="">すべて</option><option value="spot">スポット</option><option value="activity">やりたいこと</option></select></div><ItemExtraFilters filters={filters} /><button type="submit" className="kk-primary-link">探す</button>{(text || kind || query.size > 0) && <Link href="/app/items" className="kk-text-link">条件を解除</Link>}</form>}
    {type === "outings" && <nav aria-label="計画の状態" className="kk-chips"><Link href="/app/outings" aria-current={!completed && !cancelled ? "page" : undefined} className="kk-chip">計画中のおでかけ</Link><Link href="/app/outings?status=completed" aria-current={completed ? "page" : undefined} className="kk-chip">終了したおでかけ</Link><Link href="/app/outings?status=cancelled" aria-current={cancelled ? "page" : undefined} className="kk-chip">中止したおでかけ</Link></nav>}
    <div className="kk-row"><p className="kk-muted">{type === "memories" ? showVisits?`${total}件の訪問記録 · 訪問日が新しい順`:`${total}冊のアルバム` : type === "items" && text ? `「${text}」の候補` : "参加グループの共有データ"}</p>{type!=="memories"&&<Link href={addHref(type === "outings" ? "outing" : "item")} className="kk-text-link">＋ {type === "outings" ? "計画を作る" : "候補を追加"}</Link>}</div>
    {body ?? <div className="kk-empty"><h2>{page > 1 ? "このページにはありません" : showVisits?"まだ訪問記録がありません":text || kind ? "条件に合う候補がありません" : heading.empty}</h2><p>{text || kind ? "名前や種類を変えるか、条件を解除してみてください。" : type === "memories" ? showVisits?"写真とひとことを添えて、日々の「行った！」を残してみよう。":"おでかけ計画を終了すると、訪問記録がアルバムになります。日々の記録は「訪問記録」から振り返れます。" : type === "items" ? "気になる場所や、やってみたいことを追加してみよう。" : "候補を選んで、次のおでかけを計画してみよう。"}</p><Link href={type === "memories" ? showVisits?addHref("visit"):"/app/outings" : addHref(type === "outings" ? "outing" : "item")} className="kk-primary-link">{type === "memories" ? showVisits?"訪問を記録":"おでかけへ" : type === "outings" ? "計画を作る" : "行きたいを追加"}</Link></div>}
    {(page > 1 || page * 20 < total) && <nav aria-label="一覧のページ" className="kk-pager">{page > 1 ? <Link href={href(page - 1)} className="kk-text-link">← 前のページ</Link> : <span />}<span>{page}ページ</span>{page * 20 < total ? <Link href={href(page + 1)} className="kk-text-link">次のページ →</Link> : <span />}</nav>}
  </div>;
}
