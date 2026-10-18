import { AccountDeletionSection } from "@/components/groups/departure-sections";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { DisplayNameForm } from "@/components/profiles/display-name-form";
import { getMyProfile, ProfileStoreError } from "@/lib/profiles/repository";
import { LogoutButton } from "@/components/logout-button";
import {MyPhotoSection} from "@/components/profiles/presentation-sections";

async function ProfileContent() {
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/auth/login?next=/app/profile");
  try {
    return <><DisplayNameForm initialName={(await getMyProfile(client, data.claims.sub)) ?? ""} /><Suspense fallback={<p role="status">写真を読み込んでいます…</p>}><MyPhotoSection client={client}/></Suspense><Suspense fallback={<p role="status">アカウント削除の情報を読み込んでいます…</p>}><AccountDeletionSection client={client}/></Suspense></>;
  } catch (cause) {
    return <p role="alert" className="rounded-3xl border bg-white p-6">{cause instanceof ProfileStoreError ? cause.message : "表示名を読み込めませんでした。"}</p>;
  }
}

export default function ProfilePage() {
  return <div className="mx-auto max-w-2xl space-y-6"><Link href="/app" className="kk-text-link">← ホームへ</Link><div><p className="kk-eyebrow">アカウント</p><h1 className="mt-2 text-3xl font-bold">あなたのプロフィール</h1><p className="mt-3 text-stone-600">この表示名で、一緒におでかけする仲間に見えます。</p></div><Suspense fallback={<p role="status">表示名を読み込んでいます…</p>}><ProfileContent /></Suspense><div className="kk-row kk-surface"><Link href="/app/groups" className="kk-text-link">マイグループ</Link><LogoutButton /></div></div>;
}
