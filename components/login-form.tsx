"use client";

import {PocketMark} from "@/components/brand/pocket-mark";
import { cn, hasEnvVars } from "@/lib/utils";
import { appNextPath, authEntryPath } from "@/lib/auth/safe-next-path";
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
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function LoginForm({
  className,
  nextPath = "/app",
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const submitting = useRef(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEnvVars || submitting.current) return;
    submitting.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.replace(appNextPath(nextPath));
      router.refresh();
    } catch {
      setError("ログインできませんでした。メールアドレス・パスワードと、メール確認が済んでいるかをご確認ください。");
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader><PocketMark className="kk-pocket-login-mark"/>
          <CardTitle className="text-2xl">いこポケにログイン</CardTitle>
          <CardDescription>
            メールアドレスとパスワードを入力してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasEnvVars && <AuthSetupNotice />}
          <form onSubmit={handleLogin} aria-busy={isLoading} className="mt-4">
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
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">パスワード</Label>
                    <Link
                      href="/auth/forgot-password"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    >
                      パスワードを忘れた方
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <Button type="submit" className="min-h-11 w-full" disabled={isLoading}>
                  {isLoading ? "ログイン中…" : "ログイン"}
                </Button>
              </div>
            </fieldset>
            <div className="mt-4 text-center text-sm">
              初めての方は{" "}
              <Link
                href={authEntryPath("sign-up", nextPath)}
                className="underline underline-offset-4"
              >
                アカウント作成
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
