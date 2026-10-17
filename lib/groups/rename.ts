import { isGroupId, parseGroupInput, GROUP_NAME_LIMIT } from "@/lib/groups/validation";

export type RenameGroupState = { error: string | null; savedName?: string };
export function parseGroupRename(form: FormData): { groupId: string; name: string; expectedName: string } {
  const groupId = form.get("groupId"), expectedName = form.get("expectedName");
  if (!isGroupId(groupId) || typeof expectedName !== "string" || Array.from(expectedName).length > GROUP_NAME_LIMIT) throw new Error("画面を開き直して、もう一度お試しください。");
  const { name } = parseGroupInput(form.get("name"), groupId);
  return { groupId, name, expectedName };
}
