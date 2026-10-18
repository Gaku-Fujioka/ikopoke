import { isCalendarDate } from "@/lib/outings/calendar";
import { isGroupId } from "@/lib/groups/validation";
import type { OutingMode, OutingPeriod } from "./validation";
export type TripStop = { id: string; item_id: string; planned_time: string | null; period: OutingPeriod | null };
export type TripDay = { mode: OutingMode; participants: string[]; items: TripStop[] };
export function dateDistance(start: string, end: string): number { return Math.round((Date.parse(`${end}T00:00:00Z`)-Date.parse(`${start}T00:00:00Z`))/86400000); }
export function shiftDay(start: string, offset: number): string {
  if (!isCalendarDate(start) || !Number.isInteger(offset)) return "";
  const date = new Date(`${start}T00:00:00Z`); date.setUTCDate(date.getUTCDate()+offset);
  return date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999 ? date.toISOString().slice(0,10) : "";
}
function people(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50 || !value.every(isGroupId) || new Set(value).size !== value.length) throw new Error("各日の参加者を1〜50人選んでください。");
  return value;
}
export function parseTrip(form: FormData) {
  const groupId=form.get("groupId"),outingId=form.get("outingId"),expectedRevision=Number(form.get("expectedRevision"));
  const title=form.get("title"),start=form.get("start"),end=form.get("end"),memo=form.get("memo");
  if (!isGroupId(groupId)||!isGroupId(outingId)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0) throw new Error("画面を開き直してください。");
  if(typeof title!=="string"||!title.trim()||Array.from(title.trim()).length>120||typeof memo!=="string"||Array.from(memo).length>2000)throw new Error("計画名は1〜120文字、メモは2,000文字以内で入力してください。");
  if(!isCalendarDate(start)||!isCalendarDate(end)||dateDistance(start,end)<0||dateDistance(start,end)>=366)throw new Error("開始日と終了日を366日以内の期間で選んでください。");
  let raw:unknown,participants:unknown,removed:unknown;
  try{raw=JSON.parse(String(form.get("days")));participants=JSON.parse(String(form.get("participants")));removed=JSON.parse(String(form.get("removedIds")));}catch{throw new Error("日ごとの計画を選び直してください。");}
  if(!Array.isArray(raw)||raw.length!==dateDistance(start,end)+1)throw new Error("各日の内容と期間をご確認ください。");
  const seen=new Set<string>();
  const days:TripDay[]=raw.map((value:unknown)=>{
    if(!value||typeof value!=="object")throw new Error("各日の内容をご確認ください。");const day=value as Record<string,unknown>;
    if(!["exact","period","order"].includes(String(day.mode))||!Array.isArray(day.items))throw new Error("各日のモードをご確認ください。");
    const mode=day.mode as OutingMode;
    const items:TripStop[]=day.items.map((entry:unknown)=>{
      if(!entry||typeof entry!=="object")throw new Error("候補を選び直してください。");const slot=entry as Record<string,unknown>;
      if(!isGroupId(slot.id)||!isGroupId(slot.item_id)||seen.has(slot.id))throw new Error("行き先の情報を確認できませんでした。");seen.add(slot.id);
      const time=slot.planned_time||null,period=slot.period||null;
      if(time!==null&&(typeof time!=="string"||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))throw new Error("行き先の時刻をご確認ください。");
      if(period!==null&&!['morning','noon','afternoon','night'].includes(String(period)))throw new Error("行き先の時間帯をご確認ください。");
      if((mode==='exact'&&!time)||(mode==='period'&&!period))throw new Error("選んだモードに合わせて、各行き先の時刻・時間帯を入力してください。");
      return {id:slot.id,item_id:slot.item_id,planned_time:time as string|null,period:period as OutingPeriod|null};
    });return {mode,participants:people(day.participants),items};
  });
  if(seen.size<1||seen.size>50)throw new Error("旅行全体で行き先を1〜50件選んでください。");
  if(!Array.isArray(removed)||removed.length>50||!removed.every(isGroupId)||new Set(removed).size!==removed.length||removed.some(id=>seen.has(id)))throw new Error("外した行き先を確認できませんでした。");
  return {groupId,outingId,expectedRevision,title:title.trim(),start,end,memo,days,participants:people(participants),removedIds:removed as string[]};
}
