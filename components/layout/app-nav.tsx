"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, CalendarDays, House, Images } from "lucide-react";
import { isGroupId } from "@/lib/groups/validation";

const tabs = [
  { href: "/app", label: "ホーム", icon: House },
  { href: "/app/items", label: "行きたい", icon: Bookmark },
  { href: "/app/outings", label: "おでかけ", icon: CalendarDays },
  { href: "/app/memories", label: "思い出", icon: Images },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const matchedGroupId = /^\/app\/groups\/([^/]+)/.exec(pathname)?.[1];
  const groupId = isGroupId(matchedGroupId) ? matchedGroupId : null;
  const destinations = groupId ? tabs.map(tab => tab.href === "/app/items" ? { ...tab, href: `/app/groups/${groupId}/items` } : tab.href === "/app/outings" ? { ...tab, href: `/app/groups/${groupId}/outings` } : tab.href === "/app/memories" ? { ...tab, href: `/app/groups/${groupId}/memories` } : tab) : tabs;

  return (
    <nav
      aria-label="アプリのメインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:border-b md:border-t-0 md:pb-0"
    >
      <div className="mx-auto grid max-w-5xl grid-cols-4 gap-1 px-2 py-2 md:px-6">
        {destinations.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/app"
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 md:min-h-12 md:flex-row md:text-sm ${
                active
                  ? "bg-orange-50 text-orange-700"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
