import { Suspense } from "react";
import { GlobalCollection, type CollectionSearch } from "@/components/home/global-collection";
export default function MemoriesPage({ searchParams }: { searchParams: Promise<CollectionSearch> }) {
  return <Suspense fallback={<p role="status" className="kk-loading">思い出を読み込んでいます…</p>}><GlobalCollection type="memories" searchParams={searchParams} /></Suspense>;
}
