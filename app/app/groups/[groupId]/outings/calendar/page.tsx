import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getGroup } from "@/lib/groups/repository";
import { isGroupId } from "@/lib/groups/validation";
import { listOutings, OutingStoreError } from "@/lib/outings/repository";
import { calendarHref, calendarMonth, japanCalendarToday, selectedCalendarDay } from "@/lib/outings/calendar";
import { OutingCalendar } from "@/components/outings/outing-calendar";
import { AuthSetupNotice } from "@/components/auth-setup-notice";

type Props = { params: Promise<{ groupId: string }>; searchParams: Promise<{ month?: string | string[]; day?: string | string[] }> };

async function CalendarContent({ params, searchParams }: Props) {
  const { groupId } = await params;
  if (!isGroupId(groupId)) notFound();
  if (!hasEnvVars) return <AuthSetupNotice />;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const search = await searchParams;
  const today = japanCalendarToday(new Date());
  const month = calendarMonth(search.month,today), day = selectedCalendarDay(search.day,month);
  const href = calendarHref(groupId,month,day);
  if (error || !data?.claims?.sub) redirect(`/auth/login?next=${encodeURIComponent(href)}`);
  let group, outings;
  try {
    [group, outings] = await Promise.all([getGroup(client,groupId),listOutings(client,groupId)]);
  } catch (cause) {
    return <div role="alert" className="space-y-3 rounded-3xl border border-stone-200 bg-white p-6"><p>{cause instanceof OutingStoreError ? cause.message : "カレンダーを読み込めませんでした。"}</p><Link href={href} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">再読み込み</Link></div>;
  }
  if (!group) notFound();
  return <div className="space-y-6">
    <Link href={`/app/groups/${groupId}/outings`} className="inline-flex min-h-11 items-center font-semibold text-orange-700 underline">← 計画一覧へ</Link>
    <div><p className="text-sm font-semibold text-orange-700">{group.name}</p><h1 className="mt-2 text-3xl font-bold">おでかけカレンダー</h1><p className="mt-3 text-sm leading-6 text-stone-600">グループで保存した計画を、予定日から探せます。</p></div>
    <OutingCalendar groupId={groupId} outings={outings} month={month} today={today} selectedDay={day} />
  </div>;
}

export default function CalendarPage(props: Props) {
  return <div className="mx-auto max-w-3xl"><Suspense fallback={<p role="status">カレンダーを読み込んでいます…</p>}><CalendarContent {...props} /></Suspense></div>;
}
