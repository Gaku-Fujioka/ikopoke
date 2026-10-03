import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export default function OutingsPage() {
  return (
    <SectionPlaceholder
      eyebrow="おでかけ"
      title="次のおでかけを考えよう。"
      description="行きたい候補をつないで、日付や順番を決めるための画面です。"
      nextHref="/app/memories"
      nextLabel="思い出の入口へ"
    />
  );
}
