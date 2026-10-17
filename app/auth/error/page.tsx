import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <>
      <p role="alert" className="text-sm leading-6 text-muted-foreground">{reason === "configuration"
        ? "ログイン機能は準備中です。設定が終わってからもう一度お試しください。"
        : "確認リンクが無効か、有効期限が切れています。ログインを試すか、パスワード再設定のメールをもう一度送ってください。"}</p>
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                認証を完了できませんでした
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<p role="status">確認しています…</p>}>
                <ErrorContent searchParams={searchParams} />
              </Suspense>
              <Link href="/auth/login" className="mt-4 flex min-h-11 items-center text-sm underline underline-offset-4">ログインへ</Link>
              <Link href="/auth/forgot-password" className="flex min-h-11 items-center text-sm underline underline-offset-4">パスワード再設定へ</Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
