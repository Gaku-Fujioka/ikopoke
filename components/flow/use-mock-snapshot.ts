"use client";

import { useState, useSyncExternalStore } from "react";
import { createMockSnapshotStore } from "@/lib/kokoiko/snapshot-store";
export { messageFromError } from "@/lib/kokoiko/snapshot-store";

export function useMockSnapshot() {
  const [store] = useState(() => createMockSnapshotStore(() => window.localStorage));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...snapshot, reload: store.reload };
}
