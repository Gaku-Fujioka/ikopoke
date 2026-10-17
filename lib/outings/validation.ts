const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export type OutingMode = "exact" | "period" | "order";
export type OutingPeriod = "morning" | "noon" | "afternoon" | "night";
export type OutingSlot = { item_id: string; planned_time: string | null; period: OutingPeriod | null };
export type OutingInput = {
  groupId: string; outingId: string; expectedRevision: number;
  title: string; date: string; mode: OutingMode; memo: string;
  items: OutingSlot[]; participants: string[];
};

export const OUTING_MODES: { value: OutingMode; label: string }[] = [
  { value: "exact", label: "時刻指定" }, { value: "period", label: "時間帯" }, { value: "order", label: "時間なし" },
];
export const OUTING_PERIODS: { value: OutingPeriod; label: string }[] = [
  { value: "morning", label: "午前" }, { value: "noon", label: "昼" }, { value: "afternoon", label: "午後" }, { value: "night", label: "夜" },
];

export function parseOutingInput(form: FormData): OutingInput {
  const groupId = form.get("groupId"), outingId = form.get("outingId"), revision = Number(form.get("expectedRevision"));
  const rawTitle = form.get("title"), rawDate = form.get("date"), rawMode = form.get("mode"), rawMemo = form.get("memo");
  if (!isUuid(groupId) || !isUuid(outingId) || !Number.isInteger(revision) || revision < 0) throw new Error("画面を読み込み直して、もう一度お試しください。");
  if (typeof rawTitle !== "string" || !rawTitle.trim() || Array.from(rawTitle.trim()).length > 120) throw new Error("計画の名前を120文字以内で入力してください。");
  if (typeof rawDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || Number.isNaN(Date.parse(`${rawDate}T00:00:00Z`)) || new Date(`${rawDate}T00:00:00Z`).toISOString().slice(0,10) !== rawDate) throw new Error("有効な日付を選んでください。");
  if (rawMode !== "exact" && rawMode !== "period" && rawMode !== "order") throw new Error("計画モードを選んでください。");
  if (typeof rawMemo !== "string" || Array.from(rawMemo).length > 2000) throw new Error("メモは2,000文字以内で入力してください。");
  let rawItems: unknown, rawParticipants: unknown;
  try { rawItems = JSON.parse(String(form.get("items"))); rawParticipants = JSON.parse(String(form.get("participants"))); }
  catch { throw new Error("候補と参加者を選び直してください。"); }
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 50) throw new Error("候補を1〜50件選んでください。");
  if (!Array.isArray(rawParticipants) || rawParticipants.length < 1 || rawParticipants.length > 50) throw new Error("参加者を1〜50人選んでください。");
  const itemIds = new Set<string>();
  const items: OutingSlot[] = rawItems.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("候補を選び直してください。");
    const value = entry as Record<string, unknown>;
    if (!isUuid(value.item_id) || itemIds.has(value.item_id)) throw new Error("同じ候補は1回だけ選んでください。");
    itemIds.add(value.item_id);
    const time = value.planned_time === "" || value.planned_time == null ? null : value.planned_time;
    const period = value.period === "" || value.period == null ? null : value.period;
    if (time !== null && (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error("時刻を確認してください。");
    if (period !== null && period !== "morning" && period !== "noon" && period !== "afternoon" && period !== "night") throw new Error("時間帯を確認してください。");
    if (rawMode === "exact" && !time) throw new Error("各候補の時刻を入力してください。");
    if (rawMode === "period" && !period) throw new Error("各候補の時間帯を選んでください。");
    return { item_id: value.item_id, planned_time: time as string | null, period: period as OutingPeriod | null };
  });
  const participants = rawParticipants as unknown[];
  if (participants.some(id => !isUuid(id)) || new Set(participants).size !== participants.length) throw new Error("参加者を選び直してください。");
  return { groupId, outingId, expectedRevision: revision, title: rawTitle.trim(), date: rawDate, mode: rawMode, memo: rawMemo, items, participants: participants as string[] };
}
