"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/auth/login");
      router.refresh();
    } catch {
      setError("ログアウトできませんでした。もう一度お試しください。");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return <div className="space-y-2"><Button onClick={logout} disabled={saving}>{saving ? "ログアウト中…" : "ログアウト"}</Button>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>;
}
