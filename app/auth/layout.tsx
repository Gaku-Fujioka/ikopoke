import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div lang="ja" className="kk-app kk-color-preview">{children}</div>;
}
