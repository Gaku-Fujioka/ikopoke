"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  const router = useRouter(), [pending, startTransition] = useTransition();
  return <button type="button" className="kk-text-link" disabled={pending} onClick={() => startTransition(() => router.refresh())}><RefreshCw aria-hidden="true" size={15} className={pending ? "animate-spin" : ""} />{pending ? "更新中…" : "更新"}</button>;
}
