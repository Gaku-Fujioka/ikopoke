"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RetryItems() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 disabled:opacity-60">
      {pending ? "読み込んでいます…" : "もう一度読み込む"}
    </button>
  );
}
