import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function Page() {
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
              <Link href="/auth/login" className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4">ログインへ</Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
