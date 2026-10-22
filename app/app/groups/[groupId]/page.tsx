import { Suspense } from "react";
import { SharedHome } from "@/components/home/shared-home";
import { TabLoading } from "@/components/layout/tab-loading";

async function GroupHome({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <SharedHome groupId={groupId} />;
}
export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  return <Suspense fallback={<TabLoading label="グループのホーム" />}><GroupHome params={params} /></Suspense>;
}
