export const GROUP_NAME_LIMIT = 80;

export function isGroupId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function parseGroupInput(name: unknown, requestId: unknown): { name: string; requestId: string } {
  if (typeof name !== "string" || !name.trim()) throw new Error("グループの名前を入力してください。");
  const trimmed = name.trim();
  if (Array.from(trimmed).length > GROUP_NAME_LIMIT) throw new Error("グループの名前は80文字以内で入力してください。");
  if (!isGroupId(requestId)) throw new Error("画面を読み込み直して、もう一度お試しください。");
  return { name: trimmed, requestId };
}
