import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { listGroups, GroupStoreError } from "@/lib/groups/repository";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { AuthSetupNotice } from "@/components/auth-setup-notice";

async function GroupsContent() {
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/auth/login?next=/app/groups");
  let groups;
  try {
    groups = await listGroups(client);
  } catch (cause) {
    return <div className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6"><p role="alert" className="leading-7 text-stone-700">{cause instanceof GroupStoreError ? cause.message : "グループを読み込めませんでした。もう一度お試しください。"}</p><Link href="/app/groups" className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">再読み込み</Link></div>;
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="group-list-title" className="space-y-4">
        <h2 id="group-list-title" className="text-2xl font-bold">参加しているグループ（{groups.length}件）</h2>
        {groups.length === 0 ? <p className="rounded-3xl border border-stone-200 bg-white p-6 leading-7 text-stone-600">グループはまだありません。下のフォームから作成できます。</p> : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {groups.map((group) => <li key={group.id} className="min-w-0"><Link href={`/app/groups/${group.id}`} className="block h-full rounded-3xl border border-stone-200 bg-white p-6 hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"><h3 className="break-words text-xl font-semibold">{group.name}</h3><p className="mt-4 text-sm font-semibold text-orange-700">このグループを開く →</p></Link></li>)}
          </ul>
        )}
      </section>
      <CreateGroupForm requestId={randomUUID()} />
    </div>
  );
}

export default function GroupsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <div><p className="text-sm font-semibold tracking-widest text-orange-700">グループ</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">一緒に出かける仲間</h1><p className="mt-3 text-sm leading-6 text-stone-600">グループ名と参加情報はアカウントに紐づけて保存します。</p></div>
      <Suspense fallback={<p role="status">グループを読み込んでいます…</p>}><GroupsContent /></Suspense>
    </div>
  );
}
