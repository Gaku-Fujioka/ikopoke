import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { getGroup } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { CreateItemForm } from "@/components/items/create-item-form";
import { listLists } from "@/lib/lists/repository";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { HomeError } from "@/components/home/shared-home";

async function Content({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isGroupId(groupId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient(), { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(`/app/groups/${groupId}/items/new`)}`);
  let group;
  try { group = await getGroup(client, groupId); } catch { return <HomeError />; }
  if (!group) notFound();
  let lists: { id: string; name: string }[] = [], listsUnavailable = false, moreLists = false;
  try { const saved = await listLists(client, groupId, 1); lists = saved.lists; moreLists = saved.total > lists.length; } catch { listsUnavailable = true; }
  return <div className="mx-auto max-w-2xl space-y-6"><Link href={`/app/groups/${groupId}/items`} className="kk-text-link">← 行きたいへ</Link><div className="kk-page-heading"><p className="kk-eyebrow">{group.name}に、ひとつのきっかけ</p><h1>ここ、行ってみない？</h1><p>名前だけでも大丈夫。気になる理由も、一緒に残そう。</p></div><CreateItemForm groupId={group.id} groupName={group.name} requestId={randomUUID()} lists={lists} listsUnavailable={listsUnavailable} moreLists={moreLists} /></div>;
}
export default function NewItemPage(props: { params: Promise<{ groupId: string }> }) {
  return <Suspense fallback={<p role="status" className="kk-loading">追加画面を読み込んでいます…</p>}><Content {...props} /></Suspense>;
}
