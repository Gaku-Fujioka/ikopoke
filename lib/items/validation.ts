import { isGroupId } from "@/lib/groups/validation";

export const ITEM_TITLE_LIMIT = 100;
export const ITEM_MEMO_LIMIT = 2000;
export type ItemInput = { groupId: string; requestId: string; title: string; kind: "spot" | "activity"; memo: string };
export type ItemField = "title" | "kind" | "memo";

export class ItemInputError extends Error {
  field?: ItemField;
  constructor(message: string, field?: ItemField) {
    super(message);
    this.name = "ItemInputError";
    this.field = field;
  }
}

export function parseItemInput(form: FormData): ItemInput {
  const groupId = form.get("groupId"), requestId = form.get("requestId");
  if (!isGroupId(groupId) || !isGroupId(requestId)) throw new ItemInputError("画面を読み込み直して、もう一度お試しください。");
  const rawTitle = form.get("title"), kind = form.get("kind"), rawMemo = form.get("memo");
  if (typeof rawTitle !== "string" || !rawTitle.trim()) throw new ItemInputError("候補の名前を入力してください。", "title");
  const title = rawTitle.trim();
  if (Array.from(title).length > ITEM_TITLE_LIMIT) throw new ItemInputError("候補の名前は100文字以内で入力してください。", "title");
  if (kind !== "spot" && kind !== "activity") throw new ItemInputError("スポットか、やりたいことを選んでください。", "kind");
  if (rawMemo !== null && typeof rawMemo !== "string") throw new ItemInputError("メモを文字で入力してください。", "memo");
  const memo = (rawMemo ?? "").trim();
  if (Array.from(memo).length > ITEM_MEMO_LIMIT) throw new ItemInputError("メモは2,000文字以内で入力してください。", "memo");
  return { groupId, requestId, title, kind, memo };
}

export function itemPage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) return 1;
  return Number(value);
}
