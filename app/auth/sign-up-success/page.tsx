import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { authEntryPath } from "@/lib/auth/safe-next-path";
import { Suspense } from "react";

async function ReturnToLogin({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <Link href={authEntryPath("login", typeof next === "string" ? next : null)} className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4">ログインへ</Link>;
}

export default function Page({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                確認メールを送りました
              </CardTitle>
              <CardDescription>メール内のリンクを開いて登録を完了してください</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                受信トレイと迷惑メールフォルダーをご確認ください。リンクが開けない場合は、登録したブラウザでもう一度お試しください。
              </p>
              <Suspense fallback={<p>ログインへのリンクを準備しています…</p>}><ReturnToLogin searchParams={searchParams} /></Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
