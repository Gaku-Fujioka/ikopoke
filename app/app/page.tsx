import { Suspense } from "react";
import { SharedHome } from "@/components/home/shared-home";
import { TabLoading } from "@/components/layout/tab-loading";

export default function AppHomePage() {
  return <Suspense fallback={<TabLoading label="ホーム" />}><SharedHome /></Suspense>;
}
