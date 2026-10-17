export const DISPLAY_NAME_LIMIT = 80;

export function parseDisplayName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("表示名を入力してください。");
  const name = value.trim();
  if (Array.from(name).length > DISPLAY_NAME_LIMIT) throw new Error("表示名は80文字以内で入力してください。");
  return name;
}
