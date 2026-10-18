import { Suspense } from "react";
import { ActivityPageContent, type ActivitySearch } from "@/components/home/activity-page";
async function Content({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<ActivitySearch> }) {
  const { groupId } = await params;
  return <ActivityPageContent groupId={groupId} searchParams={searchParams} />;
}
export default function GroupActivityPage(props: { params: Promise<{ groupId: string }>; searchParams: Promise<ActivitySearch> }) {
  return <Suspense fallback={<p role="status" className="kk-loading">近況を読み込んでいます…</p>}><Content {...props} /></Suspense>;
}
