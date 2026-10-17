"use client";

import { cn, hasEnvVars } from "@/lib/utils";
import { appNextPath, authEntryPath } from "@/lib/auth/safe-next-path";
import { signUpErrorMessage } from "@/lib/auth/sign-up-error";
import { DISPLAY_NAME_LIMIT, parseDisplayName } from "@/lib/profiles/validation";
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

export function SignUpForm({
  className,
  nextPath = "/app",
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const submitting = useRef(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEnvVars || submitting.current) return;
    setError(null);

    let name: string;
    try {
      name = parseDisplayName(displayName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "表示名を確認してください。");
      return;
    }

    if (password !== repeatPassword) {
      setError("確認用パスワードが一致しません。");
      return;
    }

    submitting.current = true;
    setIsLoading(true);
    try {
      const supabase = createClient();
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", appNextPath(nextPath));
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callback.href,
          data: { display_name: name },
        },
      });
      if (error) throw error;
      // Local Supabase can disable email confirmation and return a session.
      router.replace(data.session ? appNextPath(nextPath) : authEntryPath("sign-up-success", nextPath));
      router.refresh();
    } catch (error) {
      setError(signUpErrorMessage(error));
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">アカウントを作成</CardTitle>
          <CardDescription>メールで本人確認をして、ここいこを始めましょう。</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasEnvVars && <AuthSetupNotice />}
          <form onSubmit={handleSignUp} aria-busy={isLoading} className="mt-4">
            <fieldset className="min-w-0" disabled={!hasEnvVars || isLoading}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="display-name">表示名</Label>
                  <Input id="display-name" type="text" autoComplete="nickname" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  <p className="text-sm text-stone-600">{DISPLAY_NAME_LIMIT}文字以内。</p>
                  <p className="text-sm text-stone-600">同じグループの参加者に表示されます。メールアドレスは表示しません。</p>
                </div>
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
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="repeat-password">パスワード（確認）</Label>
                  </div>
                  <Input
                    id="repeat-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                  />
                </div>
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <Button type="submit" className="min-h-11 w-full" disabled={isLoading}>
                  {isLoading ? "作成中…" : "アカウントを作成"}
                </Button>
              </div>
            </fieldset>
            <div className="mt-4 text-center text-sm">
              アカウントをお持ちの方は{" "}
              <Link href={authEntryPath("login", nextPath)} className="underline underline-offset-4">
                ログイン
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
