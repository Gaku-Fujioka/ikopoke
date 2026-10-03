import type { ReactNode } from "react";
import { AppNav } from "@/components/layout/app-nav";

export default function MockAppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-[#faf9f6] text-stone-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-stone-900 focus:ring-2 focus:ring-orange-700"
      >
        本文へスキップ
      </a>
      <header className="bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
          <div className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-700 text-white">こ</span>
            <span>ここいこ</span>
          </div>
          <div className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700">
            デモグループ
          </div>
        </div>
      </header>

      <AppNav />

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl px-5 pb-28 pt-9 outline-none sm:px-6 sm:pt-12 md:pb-16">
        {children}
        <p className="mt-12 border-t border-stone-200 pt-5 text-xs leading-6 text-stone-500">
          P1画面モックです。実APIへの接続、共有、保存はまだ行われません。
        </p>
      </main>
    </div>
  );
}
