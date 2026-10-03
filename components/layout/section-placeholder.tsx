import Link from "next/link";

type SectionPlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  nextHref: string;
  nextLabel: string;
};

export function SectionPlaceholder({
  eyebrow,
  title,
  description,
  nextHref,
  nextLabel,
}: SectionPlaceholderProps) {
  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold tracking-widest text-orange-700">{eyebrow}</p>
        <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">{title}</h1>
        <p className="max-w-xl text-base leading-7 text-stone-600">{description}</p>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-9">
        <div aria-hidden="true" className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-3xl text-orange-700">
          ✳
        </div>
        <h2 className="text-xl font-semibold text-stone-900">ここから始まります</h2>
        <p className="mt-2 max-w-lg leading-7 text-stone-600">
          いまは画面の入口を試すためのデモです。この画面のデータ表示や保存は、まだ利用できません。
        </p>
        <Link
          href={nextHref}
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-orange-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2"
        >
          {nextLabel}
        </Link>
      </div>
    </section>
  );
}
