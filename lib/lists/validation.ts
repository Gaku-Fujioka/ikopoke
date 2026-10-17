import { isGroupId } from "@/lib/groups/validation";

export const LIST_NAME_LIMIT = 80;
export const LIST_SEARCH_LIMIT = 100;
export const LIST_PAGE_SIZE = 20;

export function listName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("リストの名前を入力してください。");
  const name = value.trim();
  if (Array.from(name).length > LIST_NAME_LIMIT) throw new Error("リストの名前は80文字以内で入力してください。");
  return name;
}

export function listQuery(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validListQuery(query: string): boolean {
  return Array.from(query).length <= LIST_SEARCH_LIMIT;
}

export function listIds(form: FormData, ...names: string[]): string[] {
  return names.map(name => {
    const value = form.get(name);
    if (!isGroupId(value)) throw new Error("画面を読み込み直して、もう一度お試しください。");
    return value;
  });
}

export function listHref(groupId: string, query = "", page = 1): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return `/app/groups/${encodeURIComponent(groupId)}/lists${suffix ? `?${suffix}` : ""}`;
}
