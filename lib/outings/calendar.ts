/** Plans use a date, not an instant. UTC is used only for calendar arithmetic. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}

export function japanCalendarToday(now: Date): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)?.value ?? "";
  return `${part("year").padStart(4,"0")}-${part("month")}-${part("day")}`;
}

export function calendarMonth(value: unknown, today: string): string {
  return typeof value === "string" && isCalendarDate(`${value}-01`) ? value : today.slice(0,7);
}

export function selectedCalendarDay(value: unknown, month: string): string | null {
  return isCalendarDate(value) && value.startsWith(`${month}-`) ? value : null;
}

export function shiftCalendarMonth(month: string, offset: number): string | null {
  if (!isCalendarDate(`${month}-01`) || !Number.isInteger(offset)) return null;
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth()+offset);
  if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return null;
  return date.toISOString().slice(0,7);
}

export function calendarCells(month: string): (string | null)[] {
  if (!isCalendarDate(`${month}-01`)) throw new Error("invalid calendar month");
  const first = new Date(`${month}-01T00:00:00Z`);
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth()+1);
  last.setUTCDate(0);
  const days = last.getUTCDate(), start = first.getUTCDay();
  const length = Math.ceil((start+days)/7)*7;
  return Array.from({ length }, (_, index) => index >= start && index < start+days ? `${month}-${String(index-start+1).padStart(2,"0")}` : null);
}

export function calendarDateLabel(date: string): string {
  const [year,month,day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export function calendarHref(groupId: string, month: string, day?: string | null): string {
  const query = new URLSearchParams({ month });
  if (day) query.set("day",day);
  return `/app/groups/${groupId}/outings/calendar?${query}`;
}
