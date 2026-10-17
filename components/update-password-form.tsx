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
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const submitting = useRef(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEnvVars || submitting.current) return;
    setError(null);
    if (password !== repeatPassword) {
      setError("確認用パスワードが一致しません。");
      return;
    }
    submitting.current = true;
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/app");
      router.refresh();
    } catch {
      setError("パスワードを変更できませんでした。再設定メールのリンクを開き直すか、時間をおいて再度お試しください。");
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">新しいパスワードを設定</CardTitle>
          <CardDescription>
            新しいパスワードを2回入力してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasEnvVars && <AuthSetupNotice />}
          <form onSubmit={handleUpdatePassword} aria-busy={isLoading} className="mt-4">
            <fieldset className="min-w-0" disabled={!hasEnvVars || isLoading}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="password">新しいパスワード</Label>
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
                  <Label htmlFor="repeat-password">パスワード（確認）</Label>
                  <Input id="repeat-password" type="password" autoComplete="new-password" required value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} />
                </div>
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <Button type="submit" className="min-h-11 w-full" disabled={isLoading}>
                  {isLoading ? "保存中…" : "新しいパスワードを保存"}
                </Button>
              </div>
            </fieldset>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
