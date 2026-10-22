import { Suspense } from "react";
import { TabLoading } from "@/components/layout/tab-loading";
import { GlobalCollection, type CollectionSearch } from "@/components/home/global-collection";
export default function ItemsPage({ searchParams }: { searchParams: Promise<CollectionSearch> }) {
  return <Suspense fallback={<TabLoading label="行きたい" />}><GlobalCollection type="items" searchParams={searchParams} /></Suspense>;
}
