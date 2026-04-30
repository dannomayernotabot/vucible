"use client";

import { useState } from "react";
import { getStorage, setStorage } from "@/lib/storage/keys";
import { ImageCountPicker } from "@/components/round/ImageCountPicker";
import { AspectRatioPicker } from "@/components/round/AspectRatioPicker";
import type { ImageCount, AspectRatioConfig } from "@/lib/providers/types";

export function DefaultsPanel() {
  const storage = getStorage();
  const defaults = storage?.defaults;

  const [imageCount, setImageCount] = useState<ImageCount>(
    defaults?.imageCount ?? 8,
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatioConfig>(
    defaults?.aspectRatio ?? { kind: "discrete", ratio: "1:1" },
  );

  const geminiEnabled = storage?.providers.gemini !== undefined;

  const caps = Object.entries(storage?.providers ?? {})
    .filter(([, c]) => c !== undefined)
    .map(([key, c]) => ({
      ipm: c!.ipm,
      label: key === "openai" ? "OpenAI" : "Gemini",
    }));

  function saveImageCount(count: ImageCount) {
    const current = getStorage();
    if (!current) return;
    try {
      setStorage({
        ...current,
        defaults: { ...current.defaults, imageCount: count },
      });
      setImageCount(count);
    } catch {
      // QuotaExceeded — keep prior value
    }
  }

  function saveAspectRatio(ar: AspectRatioConfig) {
    const current = getStorage();
    if (!current) return;
    try {
      setStorage({
        ...current,
        defaults: { ...current.defaults, aspectRatio: ar },
      });
      setAspectRatio(ar);
    } catch {
      // QuotaExceeded — keep prior value
    }
  }

  if (!defaults) {
    return <p className="text-sm text-muted-foreground">No defaults configured.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Images per round
        </label>
        <ImageCountPicker
          value={imageCount}
          onChange={saveImageCount}
          caps={caps}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Default aspect ratio
        </label>
        <AspectRatioPicker
          geminiEnabled={geminiEnabled}
          value={aspectRatio}
          onChange={saveAspectRatio}
        />
      </div>
    </div>
  );
}
