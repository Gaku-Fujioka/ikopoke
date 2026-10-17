"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GroupEntry() {
  const inGroups = usePathname().startsWith("/app/groups");
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {!inGroups && <span className="rounded-full bg-stone-100 px-4 py-2 font-medium text-stone-700">デモグループ</span>}
      <Link href="/app/groups" aria-current={inGroups ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-full border border-stone-300 bg-white px-4 font-semibold text-stone-700 hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">グループ管理</Link>
    </div>
  );
}
