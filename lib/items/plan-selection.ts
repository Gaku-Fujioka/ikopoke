export type PlanChoice = { id: string; title: string };
type SelectionStorage = Pick<Storage, "getItem" | "setItem">;
export const SELECTION_EVENT = "kokoiko-selection-changed";
export const EMPTY_SELECTION = "[]";
export function parseSelection(raw: string): PlanChoice[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((c): c is PlanChoice => Boolean(c) && typeof c.id === "string" && /^[\da-f-]{36}$/i.test(c.id) && typeof c.title === "string").slice(0, 50) : [];
  } catch { return []; }
}

// Only explicit user changes and confirmed saves write. Reading/resuming a
// cached screen must never persist an old React snapshot over a cleared one.
export function createPlanSelectionStore(storage: () => SelectionStorage | null, notify: () => void = () => {}) {
  const fallback = new Map<string, string>();
  const key = (group: string) => `kokoiko-plan-selection:${group}`;
  function snapshot(group: string): string {
    if (fallback.has(group)) return fallback.get(group)!;
    try { return storage()?.getItem(key(group)) ?? EMPTY_SELECTION; } catch { return EMPTY_SELECTION; }
  }
  function update(group: string, change: (before: PlanChoice[]) => PlanChoice[]) {
    const next = JSON.stringify(change(parseSelection(snapshot(group))));
    try {
      const target = storage();
      if (!target) throw new Error("storage unavailable");
      target.setItem(key(group), next); fallback.delete(group);
    } catch { fallback.set(group, next); }
    notify();
  }
  return { snapshot, update, clear: (group: string) => update(group, () => []) };
}
export const planSelection = createPlanSelectionStore(
  () => typeof window === "undefined" ? null : window.sessionStorage,
  () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(SELECTION_EVENT)); },
);
