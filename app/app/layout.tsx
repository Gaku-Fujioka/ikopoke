import { Suspense, type ReactNode } from "react";
import { AppNav } from "@/components/layout/app-nav";
import { AppAccountMenu } from "@/components/app-account-menu";
import { GroupEntry } from "@/components/groups/group-entry";

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
          <div className="flex flex-wrap items-center gap-3">
            <Suspense fallback={<span className="text-sm text-stone-600">グループ</span>}><GroupEntry /></Suspense>
            <Suspense fallback={<p role="status" className="text-sm text-stone-600">ログイン状態を確認中…</p>}><AppAccountMenu /></Suspense>
          </div>
        </div>
      </header>

      <Suspense fallback={<div role="status" className="border-b border-stone-200 bg-white px-5 py-5 text-sm text-stone-600">ナビを読み込んでいます…</div>}>
        <AppNav />
      </Suspense>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl px-5 pb-28 pt-9 outline-none sm:px-6 sm:pt-12 md:pb-16">
        {children}
        <p className="mt-12 border-t border-stone-200 pt-5 text-xs leading-6 text-stone-500">
          グループ管理と、グループ内の「みんなの候補」はアカウントに紐づく保存機能です。下のナビの「行きたい・おでかけ・思い出」はデモで、このブラウザにだけ保存されます。
        </p>
      </main>
    </div>
  );
}
