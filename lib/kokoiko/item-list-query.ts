import type { ItemKind } from "./contracts";

export function itemKindFromQuery(value: string | null): ItemKind | null {
  return value === "spot" || value === "activity" ? value : null;
}

export function itemListHref(query: string, kind: ItemKind | null): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (kind) params.set("kind", kind);
  const search = params.toString();
  return `/app/items${search ? `?${search}` : ""}`;
}

export function itemDetailHref(itemId: string, query: string, kind: ItemKind | null): string {
  const listHref = itemListHref(query, kind);
  return `/app/items/${encodeURIComponent(itemId)}${listHref.slice("/app/items".length)}`;
}
