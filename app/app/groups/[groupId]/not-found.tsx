import Link from "next/link";

export default function GroupNotFound() {
  return <div className="mx-auto max-w-3xl space-y-4 rounded-3xl border border-stone-200 bg-white p-6"><h1 className="text-2xl font-semibold">グループを開けません</h1><p className="leading-7 text-stone-600">グループが存在しないか、参加していません。参加中のグループを一覧から選んでください。</p><Link href="/app/groups" className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">グループ一覧へ</Link></div>;
}
