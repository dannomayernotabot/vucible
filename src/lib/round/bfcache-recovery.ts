"use client";

import { useEffect } from "react";
import { imageCache, thumbnailCache } from "./image-cache";

export function useBfcacheRecovery(onRestore?: () => void): void {
  useEffect(() => {
    function handler(event: PageTransitionEvent) {
      if (!event.persisted) return;

      imageCache.clear();
      thumbnailCache.clear();
      onRestore?.();
    }

    window.addEventListener("pageshow", handler);
    return () => window.removeEventListener("pageshow", handler);
  }, [onRestore]);
}
