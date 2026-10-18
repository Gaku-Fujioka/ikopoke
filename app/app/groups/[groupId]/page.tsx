import { Suspense } from "react";
import { SharedHome, HomeLoading } from "@/components/home/shared-home";

async function GroupHome({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <SharedHome groupId={groupId} />;
}
export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  return <Suspense fallback={<HomeLoading>グループのホームを読み込んでいます…</HomeLoading>}><GroupHome params={params} /></Suspense>;
}
