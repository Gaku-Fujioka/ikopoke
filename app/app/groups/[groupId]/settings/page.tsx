import { GroupDepartureSection } from "@/components/groups/departure-sections";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getGroup, GroupStoreError } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { InviteManagement } from "@/components/groups/invite-management";
import { listInvites, InviteError } from "@/lib/groups/invitations";
import { RenameGroupForm } from "@/components/groups/rename-group-form";
import { getGroupMembers } from "@/lib/profiles/repository";
import {GroupProfileSection} from "@/components/profiles/presentation-sections";
import {ProfileImage} from "@/components/profiles/profile-image";

async function Members({ client, groupId }: { client: Awaited<ReturnType<typeof createClient>>; groupId: string }) {
  try {
    const members = await getGroupMembers(client, groupId);
    return <section className="kk-surface"><h2 className="text-lg font-bold">一緒に楽しむメンバー · {members.length}人</h2><ul className="mt-4 space-y-2">{members.map(member => <li key={member.user_id} className="flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3 text-sm"><ProfileImage path={member.avatar_path} alt="" fallback={Array.from(member.display_name||"・")[0]} className="kk-member-avatar"/>{member.display_name || "表示名はまだ未設定"}</li>)}</ul></section>;
  } catch {
    return <p role="alert" className="kk-notice">メンバーを読み込めませんでした。再読み込みしてください。</p>;
  }
}

async function GroupInvitations({ client, groupId }: { client: Awaited<ReturnType<typeof createClient>>; groupId: string }) {
  try {
    return <InviteManagement groupId={groupId} invites={await listInvites(client, groupId)} />;
  } catch (error) {
    return <p role="status" className="rounded-3xl border border-stone-200 bg-white p-6 text-sm leading-6 text-stone-600">{error instanceof InviteError ? error.message : "招待を読み込めませんでした。グループを開き直してください。"}</p>;
  }
}

async function GroupContent({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isGroupId(groupId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(`/app/groups/${groupId}/settings`)}`);
  let group;
  try {
    group = await getGroup(client, groupId);
  } catch (cause) {
    return <p role="alert" className="rounded-3xl border border-stone-200 bg-white p-6 leading-7">{cause instanceof GroupStoreError ? cause.message : "グループを読み込めませんでした。もう一度お試しください。"}</p>;
  }
  if (!group) notFound();
  return (
    <div className="space-y-6">
    <Link href={`/app/groups/${groupId}`} className="kk-text-link">← グループのホームへ</Link>
    <section className="space-y-5 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <p className="text-sm font-semibold tracking-widest text-orange-700">グループ設定</p>
      <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{group.name}</h1>
      <p className="leading-7 text-stone-600">グループ名や招待リンクを、メンバーみんなで管理できます。</p>
      <Link href={`/app/groups/${groupId}/items`} className="inline-flex min-h-12 items-center rounded-full bg-orange-700 px-6 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">みんなの候補へ</Link>
      <Link href={`/app/groups/${groupId}/outings`} className="ml-3 inline-flex min-h-12 items-center font-semibold text-orange-700 underline underline-offset-4">おでかけ計画へ</Link>
      <Link href={`/app/groups/${groupId}/visits`} className="ml-3 inline-flex min-h-12 items-center font-semibold text-orange-700 underline underline-offset-4">訪問記録へ</Link>
      <Link href={`/app/groups/${groupId}/memories`} className="ml-3 inline-flex min-h-12 items-center font-semibold text-orange-700 underline underline-offset-4">みんなの思い出へ</Link>
      <Link href={`/app/groups/${groupId}/lists`} className="ml-3 inline-flex min-h-12 items-center font-semibold text-orange-700 underline underline-offset-4">リストを管理</Link>
      <p className="text-sm leading-6 text-stone-500">このグループの候補・計画・訪問記録・思い出はメンバー間で共有されます。</p>
    </section>
    <Suspense fallback={<p role="status" className="kk-loading">退出の情報を読み込んでいます…</p>}><GroupDepartureSection client={client} groupId={groupId}/></Suspense>
    <RenameGroupForm groupId={groupId} name={group.name} />
    <Suspense fallback={<p role="status" className="kk-loading">グループのプロフィールを読み込んでいます…</p>}><GroupProfileSection client={client} groupId={groupId}/></Suspense>
    <Suspense fallback={<p role="status" className="kk-loading">メンバーを読み込んでいます…</p>}><Members client={client} groupId={groupId} /></Suspense>
    <Suspense fallback={<p role="status" className="rounded-3xl border border-stone-200 bg-white p-6 text-sm text-stone-600">招待を読み込んでいます…</p>}>
      <GroupInvitations client={client} groupId={groupId} />
    </Suspense>
    </div>
  );
}

export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  return <div className="mx-auto max-w-3xl space-y-7"><Suspense fallback={<p role="status">グループを読み込んでいます…</p>}><GroupContent params={params} /></Suspense></div>;
}
