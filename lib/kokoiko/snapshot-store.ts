import type { KokoikoSnapshot } from "./contracts";
import { createMockRepository, MOCK_GROUP_ID } from "./mock-repository";

type SnapshotState = { snapshot: KokoikoSnapshot | null; error: string | null; loading: boolean };
const initialState: SnapshotState = { snapshot: null, error: null, loading: true };

export function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "操作に失敗しました。もう一度お試しください。";
}

/** Cached snapshots satisfy useSyncExternalStore; manual reload publishes one new value. */
export function createMockSnapshotStore(storage: () => Parameters<typeof createMockRepository>[0]) {
  let current = initialState;
  const listeners = new Set<() => void>();
  function read() {
    try {
      current = { snapshot: createMockRepository(storage()).read(MOCK_GROUP_ID), error: null, loading: false };
    } catch (cause) {
      current = { snapshot: null, error: messageFromError(cause), loading: false };
    }
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot() {
      if (current === initialState) read();
      return current;
    },
    getServerSnapshot: () => initialState,
    reload() {
      read();
      listeners.forEach(listener => listener());
    },
  };
}
