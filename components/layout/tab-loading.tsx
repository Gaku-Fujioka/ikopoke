/** Static route shell: no session, group names, photos or database reads. */
export function TabLoading({ label = "画面" }: { label?: string }) {
  return <div className="mx-auto max-w-3xl space-y-6" data-tab-loading>
    <p role="status" className="kk-muted">{label}を読み込んでいます…</p>
    <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
      <div className="space-y-3"><div className="h-3 w-28 rounded-full bg-stone-100" /><div className="h-8 w-48 max-w-full rounded-xl bg-stone-200" /><div className="h-3 w-64 max-w-full rounded-full bg-stone-100" /></div>
      <div className="flex gap-3"><div className="h-10 w-24 rounded-full bg-orange-50" /><div className="h-10 w-24 rounded-full bg-stone-100" /></div>
      <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map(index => <div key={index} className="space-y-4 rounded-3xl border border-stone-200 bg-white p-5"><div className="h-24 rounded-2xl bg-stone-100" /><div className="h-4 w-3/4 rounded-full bg-stone-200" /><div className="h-3 w-1/2 rounded-full bg-stone-100" /></div>)}</div>
    </div>
  </div>;
}
