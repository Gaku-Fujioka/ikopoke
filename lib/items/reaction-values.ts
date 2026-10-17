export const REACTION_OPTIONS = [
  { value: "want_to_go", label: "行きたい！" },
  { value: "not_now", label: "そこまで" },
] as const;
export type ReactionValue = typeof REACTION_OPTIONS[number]["value"];
export type ReactionSummary = { want_count: number; not_now_count: number; my_reaction: ReactionValue | null };
export type ReactionState = { error: string | null; saved?: boolean };

export function reactionLabel(value: ReactionValue | null): string {
  return REACTION_OPTIONS.find((option) => option.value === value)?.label ?? "未反応";
}
