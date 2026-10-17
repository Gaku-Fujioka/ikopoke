export const ITEM_SEARCH_LIMIT = 100;

export function itemSearchQuery(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validItemSearch(query: string): boolean {
  return Array.from(query).length <= ITEM_SEARCH_LIMIT;
}

export function literalTitlePattern(query: string): string {
  // imatch preserves literal %, _ and * unlike PostgREST's LIKE * alias.
  return query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function titleSearchFilter(query: string): string {
  // Quote the PostgREST value as well as escaping the PostgreSQL pattern.
  return `"${literalTitlePattern(query).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function sharedItemListHref(groupId: string, query = "", page = 1): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return `/app/groups/${encodeURIComponent(groupId)}/items${search ? `?${search}` : ""}`;
}

export function sharedItemDetailHref(groupId: string, itemId: string, query: string, page: number): string {
  const list = sharedItemListHref(groupId, query, page);
  const [pathname, search] = list.split("?");
  return `${pathname}/${encodeURIComponent(itemId)}${search ? `?${search}` : ""}`;
}
