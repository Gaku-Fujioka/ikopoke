import { SignUpForm } from "@/components/sign-up-form";
import { appNextPath } from "@/lib/auth/safe-next-path";
import { Suspense } from "react";

async function SignUpContent({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <SignUpForm nextPath={appNextPath(typeof next === "string" ? next : null)} />;
}

export default function Page({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense fallback={<p role="status">登録画面を読み込んでいます…</p>}><SignUpContent searchParams={searchParams} /></Suspense>
      </div>
    </div>
  );
}
