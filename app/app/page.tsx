import { Suspense } from "react";
import { SharedHome, HomeLoading } from "@/components/home/shared-home";

export default function AppHomePage() {
  return <Suspense fallback={<HomeLoading>ホームを読み込んでいます…</HomeLoading>}><SharedHome /></Suspense>;
}
