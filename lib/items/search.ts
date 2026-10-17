export const ITEM_SEARCH_LIMIT = 100;
export type ItemFilters = { kind?: "spot" | "activity"; reaction?: "want_to_go" | "not_now" | "unreacted" };

export function itemFilters(values: { kind?: unknown; reaction?: unknown }): ItemFilters {
  return {
    kind: values.kind === "spot" || values.kind === "activity" ? values.kind : undefined,
    reaction: values.reaction === "want_to_go" || values.reaction === "not_now" || values.reaction === "unreacted" ? values.reaction : undefined,
  };
}

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
  // Individual PostgREST filters keep this value verbatim. IN/OR quoting rules
  // do not apply here: extra quotes would become part of the regex itself.
  return literalTitlePattern(query);
}

export function sharedItemListHref(groupId: string, query = "", page = 1, filters: ItemFilters = {}): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.reaction) params.set("reaction", filters.reaction);
  const search = params.toString();
  return `/app/groups/${encodeURIComponent(groupId)}/items${search ? `?${search}` : ""}`;
}

export function sharedItemDetailHref(groupId: string, itemId: string, query: string, page: number, filters: ItemFilters = {}): string {
  const list = sharedItemListHref(groupId, query, page, filters);
  const [pathname, search] = list.split("?");
  return `${pathname}/${encodeURIComponent(itemId)}${search ? `?${search}` : ""}`;
}

export function sharedItemCommentsHref(detailHref: string, page: number): string {
  const [pathname, search] = detailHref.split("?");
  const params = new URLSearchParams(search);
  params.delete("commentsPage");
  if (page > 1) params.set("commentsPage", String(page));
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
