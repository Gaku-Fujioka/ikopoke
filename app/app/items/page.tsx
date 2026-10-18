import { Suspense } from "react";
import { GlobalCollection, type CollectionSearch } from "@/components/home/global-collection";
export default function ItemsPage({ searchParams }: { searchParams: Promise<CollectionSearch> }) {
  return <Suspense fallback={<p role="status" className="kk-loading">行きたいを読み込んでいます…</p>}><GlobalCollection type="items" searchParams={searchParams} /></Suspense>;
}
