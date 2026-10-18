const labels = { morning: "午前", noon: "昼", afternoon: "午後", night: "夜" } as const;
export type VisitTime = { visited_time: string | null; visited_period: keyof typeof labels | null };
export function visitTimeLabel(visit: VisitTime): string {
  return visit.visited_time?.slice(0,5) ?? (visit.visited_period ? labels[visit.visited_period] : "時間の指定なし");
}
export function visitTimeMinutes(visit: VisitTime): number {
  if (visit.visited_time) {
    const [hours, minutes] = visit.visited_time.split(":").map(Number);
    return hours * 60 + minutes;
  }
  return visit.visited_period ? { morning: 0, noon: 720, afternoon: 780, night: 1080 }[visit.visited_period] : 1440;
}
