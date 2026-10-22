import { Suspense } from "react";
import { TabLoading } from "@/components/layout/tab-loading";
import { GlobalCollection, type CollectionSearch } from "@/components/home/global-collection";
export default function OutingsPage({ searchParams }: { searchParams: Promise<CollectionSearch> }) {
  return <Suspense fallback={<TabLoading label="おでかけ" />}><GlobalCollection type="outings" searchParams={searchParams} /></Suspense>;
}
