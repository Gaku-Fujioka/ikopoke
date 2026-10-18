"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { revalidateSharedHome } from "@/lib/home/revalidate";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { parseOutingInput } from "@/lib/outings/validation";
import { OutingStoreError, saveOuting } from "@/lib/outings/repository";

export type OutingActionState = { error: string | null };

export async function saveOutingAction(_previous: OutingActionState, form: FormData): Promise<OutingActionState> {
  if (!hasEnvVars) return { error: "計画機能は準備中です。" };
  let input;
  try { input = parseOutingInput(form); }
  catch (cause) { return { error: cause instanceof Error ? cause.message : "入力内容をご確認ください。" }; }
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) return { error: "ログインし直して、もう一度お試しください。" };
    await saveOuting(client, input);
  } catch (cause) {
    return { error: cause instanceof OutingStoreError ? cause.message : "計画を保存できませんでした。もう一度お試しください。" };
  }
  revalidatePath(`/app/groups/${input.groupId}/outings`);
  revalidatePath(`/app/groups/${input.groupId}/outings/calendar`);
  revalidatePath(`/app/groups/${input.groupId}/outings/${input.outingId}`);
  revalidateSharedHome(input.groupId, "outings");
  redirect(`/app/groups/${input.groupId}/outings/${input.outingId}`);
}
