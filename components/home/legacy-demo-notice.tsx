import type { ReactNode } from "react";
import Link from "next/link";
export function LegacyDemoNotice({ children }: { children: ReactNode }) {
  return <><aside className="kk-notice mb-6"><p>旧デモ画面です。このブラウザの仮データで、グループには共有されません。</p><Link className="kk-text-link" href="/app">実データのホームへ →</Link></aside>{children}</>;
}
