import Link from "next/link";

export default function ItemNotFound() {
  return (
    <div className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">候補を表示できません</h1>
      <p className="leading-7 text-stone-600">候補が見つからないか、このグループに参加していません。参加中のグループから開き直してください。</p>
      <Link href="/app/groups" className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline underline-offset-4">グループ一覧へ</Link>
    </div>
  );
}
