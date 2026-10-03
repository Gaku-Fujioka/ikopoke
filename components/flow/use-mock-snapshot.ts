"use client";

import { useCallback, useEffect, useState } from "react";
import type { KokoikoSnapshot } from "@/lib/kokoiko/contracts";
import { createMockRepository, MOCK_GROUP_ID } from "@/lib/kokoiko/mock-repository";

export function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "操作に失敗しました。もう一度お試しください。";
}

export function useMockSnapshot() {
  const [snapshot, setSnapshot] = useState<KokoikoSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    try {
      const next = createMockRepository(window.localStorage).read(MOCK_GROUP_ID);
      setSnapshot(next);
      setError(null);
    } catch (cause) {
      setSnapshot(null);
      setError(messageFromError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { snapshot, error, loading, reload };
}
