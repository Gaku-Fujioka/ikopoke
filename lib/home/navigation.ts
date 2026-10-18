import { isGroupId } from "@/lib/groups/validation";

export type AddKind = "item" | "outing" | "visit";
export type Collection = "items" | "outings" | "memories";
export function pathGroup(pathname: string): string | null {
  const id = /^\/app\/groups\/([^/]+)/.exec(pathname)?.[1];
  return isGroupId(id) ? id : null;
}
export function addHref(kind: AddKind, groupId?: string | null): string {
  const query = new URLSearchParams({ type: kind });
  if (groupId) query.set("group", groupId);
  return `/app/new?${query}`;
}
export function collectionHref(type: Collection, groupId?: string | null): string {
  return groupId ? `/app/groups/${groupId}/${type}` : `/app/${type}`;
}
export function groupTone(id: string): number {
  // Stable across sorting, renaming and pages. No meaning is assigned to a color.
  return [...id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % 4;
}
export function pageNumber(value: unknown): number {
  return typeof value === "string" && /^[1-9]\d{0,4}$/.test(value) ? Number(value) : 1;
}
export function prettyDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}
