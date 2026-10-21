import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { AppNav } from "@/components/layout/app-nav";
import { AppAccountMenu } from "@/components/app-account-menu";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <div className="kk-app kk-color-preview">
    <a href="#main-content" className="kk-skip">本文へスキップ</a>
    <header className="kk-header"><div className="kk-header-inner">
      <Link href="/app" className="kk-brand" aria-label="いこポケ 全グループのホーム"><span aria-hidden="true">い</span>いこポケ<small aria-hidden="true">✦</small></Link>
      <Suspense fallback={<span className="kk-muted">…</span>}><AppAccountMenu /></Suspense>
    </div></header>
    <main id="main-content" tabIndex={-1} className="kk-main">{children}</main>
    <Suspense fallback={<div className="kk-nav kk-nav-loading" role="status">ナビを読み込んでいます…</div>}><AppNav /></Suspense>
  </div>;
}
