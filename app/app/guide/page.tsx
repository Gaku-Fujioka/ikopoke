import Link from "next/link";
import { GuideContent } from "@/components/onboarding/guide";

export default function GuidePage() {
  return <div className="mx-auto max-w-lg space-y-5">
    <Link href="/app/profile" className="kk-text-link">← プロフィールへ</Link>
    <h1 className="text-2xl font-bold">使い方ガイド</h1>
    <p className="text-sm leading-7 text-stone-600">6つのステップで、いこポケの楽しみ方を紹介します。いつでもここで見返せます。</p>
    <div className="overflow-hidden rounded-[1.75rem] border-2 border-stone-900 bg-white"><GuideContent /></div>
  </div>;
}
