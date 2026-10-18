import { isGroupId } from "@/lib/groups/validation";
import type { CandidateOption } from "./repository";

/** URL values are only a draft. Membership/archival is checked again by save_trip. */
export function selectedCandidateIds(value: unknown): string[] {
  if (typeof value !== "string" || value.length > 1900) return [];
  const ids = value.split(",");
  return ids.length <= 50 && ids.every(isGroupId) ? [...new Set(ids)] : [];
}
export function availableSelection(ids: string[], candidates: CandidateOption[]): string[] {
  return ids.filter(id => candidates.some(candidate => candidate.id === id && !candidate.archived_at));
}
