import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export default function ItemsPage() {
  return (
    <SectionPlaceholder
      eyebrow="行きたい"
      title="行きたい場所を、ひとつずつ。"
      description="保存した場所や、やりたいことを見つけるための画面です。"
      nextHref="/app/outings"
      nextLabel="おでかけの入口へ"
    />
  );
}
