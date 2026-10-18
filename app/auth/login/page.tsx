import { LoginForm } from "@/components/login-form";
import { appNextPath } from "@/lib/auth/safe-next-path";
import { Suspense } from "react";

async function LoginContent({ searchParams }: { searchParams: Promise<{ next?: string | string[]; account?: string }> }) {
  const { next, account } = await searchParams;
  return <>{account === "deleted" && <p role="status" className="mb-5 rounded-2xl bg-orange-50 p-4 text-sm leading-6">アカウントを削除しました。一緒に使ってくれて、ありがとうございました。</p>}<LoginForm nextPath={appNextPath(typeof next === "string" ? next : null)} /></>;
}

export default function Page({ searchParams }: { searchParams: Promise<{ next?: string | string[]; account?: string }> }) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense fallback={<p role="status">ログイン画面を読み込んでいます…</p>}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
