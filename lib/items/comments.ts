import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { isGroupId } from "@/lib/groups/validation";

export const COMMENT_LIMIT = 2000;
export const COMMENT_PAGE_SIZE = 20;
export type SavedComment = { id: string; body: string; created_at: string; is_mine: boolean };
export type CommentInput = { groupId: string; itemId: string; requestId: string; body: string };
export type CommentState = { error: string | null; nextRequestId?: string };

export class CommentError extends Error {
  constructor(error: { code?: string } | null) {
    super(error && ["42P01", "PGRST202", "PGRST205"].includes(error.code ?? "")
      ? "コメント機能は準備中です。利用できるようになるまでお待ちください。"
      : error?.code === "23505"
        ? "同じ操作で別のコメントが保存されています。投稿内容を控えてから画面を開き直してください。"
        : "コメントを読み書きできませんでした。ログイン状態や通信状態をご確認のうえ、もう一度お試しください。");
    this.name = "CommentError";
  }
}

export function parseComment(form: FormData): CommentInput {
  const groupId = form.get("groupId"), itemId = form.get("itemId"), requestId = form.get("requestId"), body = form.get("body");
  if (!isGroupId(groupId) || !isGroupId(itemId) || !isGroupId(requestId)) throw new Error("画面を開き直して、もう一度お試しください。");
  if (typeof body !== "string" || !body.trim()) throw new Error("コメントを入力してください。");
  if (Array.from(body.trim()).length > COMMENT_LIMIT) throw new Error("コメントは2,000文字以内で入力してください。");
  return { groupId, itemId, requestId, body: body.trim() };
}

export async function createComment(client: SupabaseClient<Database>, input: CommentInput): Promise<void> {
  const { data, error } = await client.rpc("create_item_comment", {
    p_group_id: input.groupId, p_item_id: input.itemId, p_body: input.body, p_request_id: input.requestId,
  });
  if (error || data !== input.requestId) throw new CommentError(error);
}

export async function getComments(client: SupabaseClient<Database>, groupId: string, itemId: string, page: number): Promise<{ comments: SavedComment[]; total: number }> {
  const { data, error } = await client.rpc("get_item_comments", { p_group_id: groupId, p_item_id: itemId, p_page: page });
  const result = data?.[0];
  if (error || data?.length !== 1 || !result || !Array.isArray(result.comments) || !Number.isSafeInteger(result.total_count) || result.total_count < 0 || result.comments.length > COMMENT_PAGE_SIZE) throw new CommentError(error);
  const comments = result.comments.map((comment) => {
    if (!comment || !isGroupId(comment.id) || typeof comment.body !== "string" || !comment.body.trim() || Array.from(comment.body).length > COMMENT_LIMIT || typeof comment.is_mine !== "boolean" || typeof comment.created_at !== "string" || !Number.isFinite(Date.parse(comment.created_at))) throw new CommentError(null);
    // Return only the fields intended for display, even if a future RPC adds data.
    return { id: comment.id, body: comment.body, created_at: comment.created_at, is_mine: comment.is_mine };
  });
  return { comments, total: result.total_count };
}
