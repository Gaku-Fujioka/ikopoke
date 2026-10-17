"use client";

import { cn, hasEnvVars } from "@/lib/utils";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRef, useState } from "react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const submitting = useRef(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEnvVars || submitting.current) return;
    submitting.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      // Exchange the PKCE code before rendering the password update form.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch {
      setError("再設定メールを送信できませんでした。通信状態をご確認のうえ、時間をおいて再度お試しください。");
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">メールをご確認ください</CardTitle>
            <CardDescription>パスワード再設定の受付が完了しました</CardDescription>
          </CardHeader>
          <CardContent>
            <p role="status" className="text-sm text-muted-foreground">
              このメールアドレスで登録されている場合は、再設定の案内が届きます。メール内のリンクを開いてください。
            </p>
            <Link href="/auth/login" className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4">ログインへ戻る</Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">パスワードを再設定</CardTitle>
            <CardDescription>
              登録したメールアドレスに、再設定用のリンクを送ります。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasEnvVars && <AuthSetupNotice />}
            <form onSubmit={handleForgotPassword} aria-busy={isLoading} className="mt-4">
              <fieldset className="min-w-0" disabled={!hasEnvVars || isLoading}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="email">メールアドレス</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                  <Button type="submit" className="min-h-11 w-full" disabled={isLoading}>
                    {isLoading ? "送信中…" : "再設定メールを送る"}
                  </Button>
                </div>
              </fieldset>
              <div className="mt-4 text-center text-sm">
                パスワードが分かる方は{" "}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  ログイン
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
