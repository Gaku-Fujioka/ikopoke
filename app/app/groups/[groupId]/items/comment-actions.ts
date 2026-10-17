"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { parseComment, createComment, CommentError, type CommentState } from "@/lib/items/comments";

export async function createCommentAction(_previous: CommentState, form: FormData): Promise<CommentState> {
  if (!hasEnvVars) return { error: "コメント機能は準備中です。" };
  let input;
  try { input = parseComment(form); }
  catch (error) { return { error: error instanceof Error ? error.message : "入力内容をご確認ください。" }; }
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直して、もう一度お試しください。" };
    await createComment(client, input);
  } catch (error) {
    return { error: error instanceof CommentError ? error.message : "コメントを投稿できませんでした。もう一度お試しください。" };
  }
  revalidatePath(`/app/groups/${input.groupId}/items/${input.itemId}`);
  return { error: null, nextRequestId: randomUUID() };
}
