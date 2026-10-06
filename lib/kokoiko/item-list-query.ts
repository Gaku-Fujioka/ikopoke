import type { ItemKind } from "./contracts";

export type ReactionFilter = "want_to_go" | "not_now" | "none";

export function itemKindFromQuery(value: string | null): ItemKind | null {
  return value === "spot" || value === "activity" ? value : null;
}

export function reactionFromQuery(value: string | null): ReactionFilter | null {
  return value === "want_to_go" || value === "not_now" || value === "none" ? value : null;
}

export function itemListHref(query: string, kind: ItemKind | null, reaction: ReactionFilter | null = null): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (kind) params.set("kind", kind);
  if (reaction) params.set("reaction", reaction);
  const search = params.toString();
  return `/app/items${search ? `?${search}` : ""}`;
}

export function itemDetailHref(itemId: string, query: string, kind: ItemKind | null, reaction: ReactionFilter | null = null): string {
  const listHref = itemListHref(query, kind, reaction);
  return `/app/items/${encodeURIComponent(itemId)}${listHref.slice("/app/items".length)}`;
}
