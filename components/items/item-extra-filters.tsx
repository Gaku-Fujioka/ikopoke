import type { ItemFilters } from "@/lib/items/search";

export function ItemExtraFilters({ filters }: { filters: ItemFilters }) {
  return <>{([
    ["visited", "訪問", filters.visited ?? "", [["", "すべて"], ["unvisited", "まだ行っていない"], ["visited", "訪問済み"]]],
    ["priority", "優先度", filters.priority ?? "", [["", "すべて"], ["3", "高"], ["2", "中"], ["1", "低"], ["0", "未設定"]]],
    ["sort", "並び順", filters.sort ?? "newest", [["newest", "新しい順"], ["recommended", "おすすめ順"]]],
    ["archived", "候補の状態", filters.archived ? "1" : "", [["", "通常の候補"], ["1", "アーカイブ"]]],
  ] as const).map(([name, label, value, options]) => <label key={name} className="space-y-2 text-sm font-semibold"><span className="block">{label}</span><select key={String(value)} name={name} defaultValue={value} className="min-h-12 max-w-full rounded-xl border bg-white px-3 font-normal">{options.map(([v, text]) => <option value={v} key={v}>{text}</option>)}</select></label>)}</>;
}
