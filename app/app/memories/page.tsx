import { Suspense } from "react";
import { TabLoading } from "@/components/layout/tab-loading";
import { GlobalCollection, type CollectionSearch } from "@/components/home/global-collection";
export default function MemoriesPage({ searchParams }: { searchParams: Promise<CollectionSearch> }) {
  return <Suspense fallback={<TabLoading label="思い出" />}><GlobalCollection type="memories" searchParams={searchParams} /></Suspense>;
}
