const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const PHOTO_BUCKET = "visit-photos";
export const PHOTO_LIMIT = 10;
export const PHOTO_BYTES_LIMIT = 10 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg","image/png","image/webp"] as const;
export function visitIds(form: FormData): { groupId: string; visitId: string } {
  const groupId=form.get("groupId"), visitId=form.get("visitId");
  if (!uuid(groupId) || !uuid(visitId)) throw new Error("画面を開き直して、もう一度お試しください。");
  return { groupId,visitId };
}
export function visitFields(form: FormData): { date: string; note: string } {
  const date=form.get("date"), note=form.get("note");
  if (typeof date!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith("0000") || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date) throw new Error("有効な訪問日を選んでください。");
  if (typeof note!=="string" || Array.from(note).length>2000) throw new Error("メモは2,000文字以内で入力してください。");
  return { date,note };
}
export function visitRating(value: unknown): number | null {
  if (value === "" || value === null) return null;
  if (typeof value!=="string" || !/^[1-5]$/.test(value)) throw new Error("評価は1〜5から選んでください。");
  return Number(value);
}
export function recordVisitInput(form: FormData) {
  const ids=visitIds(form), fields=visitFields(form), itemId=form.get("itemId"), outing=form.get("outingId");
  if (!uuid(itemId) || (outing!==null && outing!=="" && !uuid(outing))) throw new Error("候補を選び直してください。");
  return { ...ids,...fields,itemId,outingId:typeof outing === "string" && outing ? outing : null,rating:visitRating(form.get("rating")) };
}
export function photoInput(form: FormData) {
  const ids=visitIds(form), photoId=form.get("photoId");
  if (!uuid(photoId)) throw new Error("写真を選び直してください。");
  return { ...ids,photoId };
}
export function photoFileInput(type: unknown, size: unknown) {
  if (typeof type!=="string" || !(PHOTO_TYPES as readonly string[]).includes(type)) throw new Error("写真はJPEG・PNG・WebP形式を選んでください。HEICなどはJPEGへ変換してから追加できます。");
  if (typeof size!=="number" || !Number.isInteger(size) || size<1 || size>PHOTO_BYTES_LIMIT) throw new Error("写真は1枚10MB以内で選んでください。");
  return { contentType:type,byteSize:size };
}
