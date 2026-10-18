import { revalidatePath } from "next/cache";

// Invalidate only the shared summaries, without making a save await their reads.
export function revalidateSharedHome(groupId: string, collection?: "items" | "outings" | "memories") {
  revalidatePath("/app");
  revalidatePath("/app/activity");
  revalidatePath(`/app/groups/${groupId}`);
  revalidatePath(`/app/groups/${groupId}/activity`);
  if (collection) revalidatePath(`/app/${collection}`);
}
