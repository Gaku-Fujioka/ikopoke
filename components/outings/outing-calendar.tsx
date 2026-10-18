import Link from "next/link";
import type { SavedOuting } from "@/lib/outings/repository";
import { OUTING_MODES } from "@/lib/outings/validation";
import { calendarCells, calendarDateLabel, calendarHref, shiftCalendarMonth } from "@/lib/outings/calendar";

export function OutingCalendar({ groupId, outings, month, today, selectedDay }: {
  groupId: string; outings: SavedOuting[]; month: string; today: string; selectedDay: string | null;
}) {
  const cells = calendarCells(month), previous = shiftCalendarMonth(month,-1), next = shiftCalendarMonth(month,1);
  const [year, monthNumber] = month.split("-").map(Number);
  const validCells = cells.filter((day): day is string => Boolean(day));
  const includes = (outing: SavedOuting, day: string) => outing.outing_date <= day && (outing.end_date ?? outing.outing_date) >= day;
  const monthOutings = outings.filter(outing => !outing.cancelled_at && outing.outing_date <= validCells.at(-1)! && (outing.end_date ?? outing.outing_date) >= validCells[0]);
  const shown = selectedDay ? monthOutings.filter(outing => includes(outing, selectedDay)) : monthOutings;
  const counts = new Map<string,number>();
  for (const day of validCells) counts.set(day, monthOutings.filter(outing => includes(outing, day)).length);
  const linkStyle = "inline-flex min-h-11 items-center px-2 font-semibold text-orange-700 underline underline-offset-4";
  return <div className="space-y-6">
    <section aria-labelledby="calendar-month-heading" className="rounded-3xl border border-stone-200 bg-white p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 id="calendar-month-heading" className="text-xl font-bold">{year}年{monthNumber}月</h2>
        <nav aria-label="表示する月" className="flex items-center gap-1">
          {previous && <Link href={calendarHref(groupId,previous)} className={linkStyle} aria-label="前の月">← 前月</Link>}
          <Link href={calendarHref(groupId,today.slice(0,7),today)} className={linkStyle}>今日</Link>
          {next && <Link href={calendarHref(groupId,next)} className={linkStyle} aria-label="次の月">翌月 →</Link>}
        </nav>
      </div>
      <form method="get" className="my-3 flex flex-wrap items-end gap-3 px-1">
        <label htmlFor="calendar-month" className="space-y-1 text-sm font-semibold"><span className="block">月を選ぶ</span><input key={month} id="calendar-month" name="month" type="month" required defaultValue={month} min="0001-01" max="9999-12" className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700" /></label>
        <button className="min-h-11 rounded-full border border-stone-300 px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700">表示</button>
      </form>
      <p className="mb-3 px-1 text-sm text-stone-600">日付を選ぶと、その日の計画を表示します。</p>
      <table className="w-full table-fixed border-collapse text-center">
        <caption className="sr-only">{year}年{monthNumber}月のおでかけ計画</caption>
        <thead><tr>{["日","月","火","水","木","金","土"].map((day,index) => <th key={day} scope="col" className={`pb-2 text-xs font-semibold ${index === 0 ? "text-red-700" : index === 6 ? "text-blue-700" : "text-stone-600"}`}>{day}<span className="sr-only">曜日</span></th>)}</tr></thead>
        <tbody>{Array.from({ length: cells.length/7 }, (_,week) => <tr key={week}>{cells.slice(week*7,week*7+7).map((day,index) => <td key={day ?? `blank-${index}`} className="border border-stone-200 p-0.5 align-top">
          {day && <Link href={calendarHref(groupId,month,day)} aria-current={day === today ? "date" : undefined} aria-label={`${calendarDateLabel(day)}、計画${counts.get(day) ?? 0}件${day === selectedDay ? "、選択中" : ""}`} className={`flex min-h-16 flex-col items-center gap-1 rounded-lg py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 sm:min-h-20 ${day === selectedDay ? "bg-orange-100 font-bold ring-1 ring-inset ring-orange-700" : "hover:bg-orange-50"}`}>
            <time dateTime={day} className={`inline-flex size-7 items-center justify-center rounded-full ${day === today ? "bg-stone-900 font-bold text-white" : ""}`}>{Number(day.slice(8))}</time>
            {(counts.get(day) ?? 0) > 0 && <span className="text-xs font-semibold text-orange-800">{counts.get(day)}件</span>}
          </Link>}
        </td>)}</tr>)}</tbody>
      </table>
    </section>
    <section aria-labelledby="calendar-plans-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="calendar-plans-heading" className="text-xl font-bold">{selectedDay ? calendarDateLabel(selectedDay) : `${year}年${monthNumber}月`}の計画（{shown.length}件）</h2>{selectedDay && <Link href={calendarHref(groupId,month)} className={linkStyle}>月の計画をすべて見る</Link>}</div>
      {shown.length ? <ul className="space-y-3">{shown.map(outing => <li key={outing.id}><Link href={`/app/groups/${groupId}/outings/${outing.id}`} className="block rounded-2xl border border-stone-200 bg-white p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"><p className="text-sm text-stone-600"><time dateTime={outing.outing_date}>{calendarDateLabel(outing.outing_date)}</time>{outing.end_date && outing.end_date !== outing.outing_date && <>〜<time dateTime={outing.end_date}>{calendarDateLabel(outing.end_date)}</time></>} · {OUTING_MODES.find(mode => mode.value === outing.mode)?.label}</p><h3 className="mt-2 break-words text-lg font-bold">{outing.title}</h3><span className="mt-3 inline-block text-sm font-semibold text-orange-700">計画を開く →</span></Link></li>)}</ul> : <p className="rounded-2xl border border-stone-200 bg-white p-5 text-stone-600">{selectedDay ? "この日の" : "この月の"}計画はまだありません。</p>}
      {selectedDay && <Link href={`/app/groups/${groupId}/outings/new?date=${selectedDay}`} className="inline-flex min-h-12 items-center rounded-full bg-orange-700 px-6 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2">この日のおでかけを作る</Link>}
    </section>
  </div>;
}
