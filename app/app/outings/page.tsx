import { Suspense } from "react";
import { GlobalCollection, type CollectionSearch } from "@/components/home/global-collection";
export default function OutingsPage({ searchParams }: { searchParams: Promise<CollectionSearch> }) {
  return <Suspense fallback={<p role="status" className="kk-loading">おでかけを読み込んでいます…</p>}><GlobalCollection type="outings" searchParams={searchParams} /></Suspense>;
}
