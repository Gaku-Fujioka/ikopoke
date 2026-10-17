import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getGroup, GroupStoreError } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { AuthSetupNotice } from "@/components/auth-setup-notice";

async function GroupContent({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isGroupId(groupId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(`/app/groups/${groupId}`)}`);
  let group;
  try {
    group = await getGroup(client, groupId);
  } catch (cause) {
    return <p role="alert" className="rounded-3xl border border-stone-200 bg-white p-6 leading-7">{cause instanceof GroupStoreError ? cause.message : "グループを読み込めませんでした。もう一度お試しください。"}</p>;
  }
  if (!group) notFound();
  return (
    <section className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <p className="text-sm font-semibold tracking-widest text-orange-700">参加中のグループ</p>
      <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{group.name}</h1>
      <p className="leading-7 text-stone-600">このグループに参加しています。別の端末でログインしても、グループ一覧から開けます。</p>
      <p className="text-sm leading-6 text-stone-500">メンバー招待と候補の共有は、これから追加します。現在の「行きたい・おでかけ・思い出」は共通のデモで、このグループの共有データには含まれません。</p>
    </section>
  );
}

export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  return <div className="mx-auto max-w-3xl space-y-7"><Link href="/app/groups" className="inline-flex min-h-11 items-center text-sm font-semibold text-stone-600 underline underline-offset-4">← グループ一覧・切替へ</Link><Suspense fallback={<p role="status">グループを読み込んでいます…</p>}><GroupContent params={params} /></Suspense></div>;
}
