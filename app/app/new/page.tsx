import type {CSSProperties} from "react";
import {groupColorStyle} from "@/lib/presentation/colors";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { listGroups } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { listItems } from "@/lib/items/repository";
import { itemSearchQuery, validItemSearch } from "@/lib/items/search";
import { addHref, groupTone, pageNumber, type AddKind } from "@/lib/home/navigation";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { HomeError } from "@/components/home/shared-home";

type Search = { type?: string; group?: string; q?: string; page?: string };
async function AddContent({ searchParams }: { searchParams: Promise<Search> }) {
  if (!hasEnvVars) return <AuthSetupNotice />;
  const search = await searchParams;
  const type: AddKind = search.type === "outing" || search.type === "visit" ? search.type : "item";
  if (search.group !== undefined && !isGroupId(search.group)) notFound();
  const groupId = search.group ?? null, text = itemSearchQuery(search.q), page = pageNumber(search.page);
  const client = await createClient(), { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(addHref(type, groupId))}`);
  let groups;
  try { groups = await listGroups(client); } catch { return <HomeError />; }
  const group = groups.find(group => group.id === groupId);
  if (groupId && !group) notFound();
  // Validate membership before routing. The destination repeats its own guard.
  if (group && type !== "visit") redirect(`/app/groups/${group.id}/${type === "item" ? "items" : "outings"}/new`);
  if (!group) return <div className="kk-collection"><Link href="/app" className="kk-text-link self-start">← ホームへ</Link><div className="kk-page-heading"><p className="kk-eyebrow">{type === "outing" ? "おでかけ計画" : type === "visit" ? "訪問記録" : "行きたい候補"}</p><h1>誰と、楽しもう？</h1><p>共有するグループを選んでください。</p></div><ul className="space-y-3">{groups.map(group => <li key={group.id}><Link href={addHref(type, group.id)} className="kk-new-group-choice" style={groupColorStyle(group.presentation?.color) as CSSProperties} data-tone={groupTone(group.id)}><UsersRound aria-hidden="true" /><span>{group.name}</span><ArrowRight aria-hidden="true" size={19} /></Link></li>)}</ul>{!groups.length && <div className="kk-empty"><p>まずは一緒に楽しむグループを作ろう。</p><Link href="/app/groups#new-group" className="kk-primary-link">グループを作る</Link></div>}</div>;
  let result;
  try { result = validItemSearch(text) ? await listItems(client, group.id, page, text) : null; } catch { return <HomeError />; }
  const pageHref = (nextPage: number) => `${addHref(type, group.id)}&${new URLSearchParams({ q: text, page: String(nextPage) })}`;
  return <div className="kk-collection"><Link href={`/app/groups/${group.id}`} className="kk-text-link self-start">← {group.name}へ</Link><div className="kk-page-heading"><p className="kk-eyebrow">{group.name}に訪問を残す</p><h1>どこに行ってきた？</h1><p>訪問した候補を選んで、写真や気持ちを残そう。計画中の訪問は、その計画からも記録できます。</p></div>
    <form action="/app/new" role="search" className="kk-map-search"><input type="hidden" name="type" value="visit" /><input type="hidden" name="group" value={group.id} /><label htmlFor="visit-candidate-q" className="sr-only">候補を名前で検索</label><input key={text} id="visit-candidate-q" type="search" name="q" defaultValue={text} placeholder="訪問した候補を探す" /><button type="submit">探す</button></form>
    {!result ? <p role="alert" className="kk-notice">検索語は100文字以内で入力してください。</p> : result.items.length ? <ul className="space-y-3">{result.items.map(item => <li key={item.id}><Link href={`/app/groups/${group.id}/visits/new?item=${item.id}`} className="kk-new-group-choice" style={groupColorStyle(group.presentation?.color) as CSSProperties} data-tone={groupTone(group.id)}><span>{item.title}</span><ArrowRight aria-hidden="true" size={19} /></Link></li>)}</ul> : <div className="kk-empty"><h2>候補が見つかりませんでした</h2><p>名前を変えて探すか、行ってきた場所を先に候補へ追加してください。</p><Link href={`/app/groups/${group.id}/items/new`} className="kk-text-link">候補を追加する →</Link></div>}
    <nav className="kk-pager" aria-label="訪問する候補のページ">{page > 1 && <Link href={pageHref(page - 1)} className="kk-text-link">← 前のページ</Link>}{result && page * 20 < result.total && <Link href={pageHref(page + 1)} className="kk-text-link">次のページ →</Link>}</nav>
  </div>;
}
export default function AddPage(props: { searchParams: Promise<Search> }) {
  return <Suspense fallback={<p role="status" className="kk-loading">追加先を読み込んでいます…</p>}><AddContent {...props} /></Suspense>;
}
