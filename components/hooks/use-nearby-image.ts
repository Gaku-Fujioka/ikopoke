"use client";

import { useCallback, useState } from "react";

/** Observe the actual mounted node and disconnect when React releases it. */
export function useNearbyImage<T extends Element>(rootMargin: string) {
  const [visible, setVisible] = useState(false);
  const ref = useCallback((node: T | null) => {
    if (!node) return;
    if (!globalThis.IntersectionObserver) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);
  return { ref, visible };
}
