import { Suspense } from "react";
import { NewOutingForm } from "@/components/flow/new-outing-form";

export default function NewOutingPage() {
  return (
    <Suspense fallback={<p role="status">フォームを読み込んでいます…</p>}>
      <NewOutingForm />
    </Suspense>
  );
}
