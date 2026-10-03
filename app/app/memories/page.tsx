import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export default function MemoriesPage() {
  return (
    <SectionPlaceholder
      eyebrow="思い出"
      title="楽しかった日を、もう一度。"
      description="おでかけで残した写真やメモを見返すための画面です。"
      nextHref="/app/items"
      nextLabel="行きたいの入口へ"
    />
  );
}
