import { Suspense } from "react";
import { ActivityPageContent, type ActivitySearch } from "@/components/home/activity-page";
export default function ActivityPage(props: { searchParams: Promise<ActivitySearch> }) {
  return <Suspense fallback={<p role="status" className="kk-loading">近況を読み込んでいます…</p>}><ActivityPageContent {...props} /></Suspense>;
}
