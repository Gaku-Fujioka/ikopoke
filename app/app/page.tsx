import Link from "next/link";
import { Bookmark, CalendarDays, Images, ArrowUpRight } from "lucide-react";

const destinations = [
  {
    href: "/app/items",
    label: "行きたい",
    description: "気になる場所や、やってみたいことの入口",
    icon: Bookmark,
  },
  {
    href: "/app/outings",
    label: "おでかけ",
    description: "行く日とプランを考える入口",
    icon: CalendarDays,
  },
  {
    href: "/app/memories",
    label: "思い出",
    description: "おでかけの記録を見返す入口",
    icon: Images,
  },
] as const;

export default function AppHomePage() {
  return (
    <div className="space-y-9">
      <div className="space-y-3">
        <p className="text-sm font-semibold tracking-widest text-orange-700">P1 デモ</p>
        <h1 className="max-w-lg text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          次の休日、<br />どこ行こう？
        </h1>
        <p className="max-w-xl leading-7 text-stone-600">
          行きたい候補を追加して、おでかけを計画し、訪問を記録して思い出まで。このブラウザで一巡できます。
        </p>
      </div>

      <section aria-labelledby="destinations-title" className="space-y-4">
        <h2 id="destinations-title" className="text-xl font-semibold">画面を見てみる</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {destinations.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-44 flex-col rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-700">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <ArrowUpRight aria-hidden="true" className="h-5 w-5 text-stone-400 group-hover:text-orange-700" />
              </div>
              <span className="mt-5 text-lg font-semibold">{label}</span>
              <span className="mt-1 text-sm leading-6 text-stone-600">{description}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
