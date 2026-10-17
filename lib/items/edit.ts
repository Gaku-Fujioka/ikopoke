import { isGroupId } from "@/lib/groups/validation";
import { ITEM_TITLE_LIMIT, ITEM_MEMO_LIMIT, ItemInputError } from "@/lib/items/validation";

export type ItemEditInput = { groupId: string; itemId: string; title: string; memo: string; expectedTitle: string; expectedMemo: string };
export type ItemEditState = { error: string | null; field?: "title" | "memo"; saved?: { title: string; memo: string } };

export function parseItemEdit(form: FormData): ItemEditInput {
  const groupId = form.get("groupId"), itemId = form.get("itemId");
  const title = form.get("title"), memo = form.get("memo");
  const expectedTitle = form.get("expectedTitle"), expectedMemo = form.get("expectedMemo");
  if (!isGroupId(groupId) || !isGroupId(itemId) || typeof expectedTitle !== "string" || typeof expectedMemo !== "string" ||
      Array.from(expectedTitle).length > ITEM_TITLE_LIMIT || Array.from(expectedMemo).length > ITEM_MEMO_LIMIT) {
    throw new ItemInputError("画面を開き直して、もう一度お試しください。");
  }
  if (typeof title !== "string" || !title.trim()) throw new ItemInputError("候補の名前を入力してください。", "title");
  if (Array.from(title.trim()).length > ITEM_TITLE_LIMIT) throw new ItemInputError("候補の名前は100文字以内で入力してください。", "title");
  if (typeof memo !== "string") throw new ItemInputError("メモを文字で入力してください。", "memo");
  if (Array.from(memo.trim()).length > ITEM_MEMO_LIMIT) throw new ItemInputError("メモは2,000文字以内で入力してください。", "memo");
  return { groupId, itemId, title: title.trim(), memo: memo.trim(), expectedTitle, expectedMemo };
}
