import Link from "next/link";

export function AuthSetupNotice() {
  return (
    <div role="status" className="space-y-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-stone-800">
      <p>ログイン機能は準備中です。設定が終わるまではデモをお試しください。</p>
      <Link href="/app" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">デモを開く</Link>
    </div>
  );
}
