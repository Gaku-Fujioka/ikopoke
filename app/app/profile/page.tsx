import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { DisplayNameForm } from "@/components/profiles/display-name-form";
import { getMyProfile, ProfileStoreError } from "@/lib/profiles/repository";

async function ProfileContent() {
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/auth/login?next=/app/profile");
  try {
    return <DisplayNameForm initialName={(await getMyProfile(client, data.claims.sub)) ?? ""} />;
  } catch (cause) {
    return <p role="alert" className="rounded-3xl border bg-white p-6">{cause instanceof ProfileStoreError ? cause.message : "表示名を読み込めませんでした。"}</p>;
  }
}

export default function ProfilePage() {
  return <div className="mx-auto max-w-2xl space-y-6"><Link href="/app/groups" className="inline-flex min-h-11 items-center text-sm font-semibold text-orange-700 underline">← グループ一覧へ</Link><div><p className="text-sm font-semibold tracking-widest text-orange-700">アカウント</p><h1 className="mt-2 text-3xl font-bold">表示名を設定</h1><p className="mt-3 text-stone-600">以前から利用している方は、ここで表示名を登録してください。メールアドレスはメンバー一覧に表示されません。</p></div><Suspense fallback={<p role="status">表示名を読み込んでいます…</p>}><ProfileContent /></Suspense></div>;
}
