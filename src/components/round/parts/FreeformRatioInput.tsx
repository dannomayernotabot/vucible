"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DiscreteRatioGrid } from "./DiscreteRatioGrid";
import type { GeminiSupportedRatio } from "@/lib/providers/types";

interface FreeformRatioInputProps {
  readonly width: number;
  readonly height: number;
  readonly onChangeWidth: (w: number) => void;
  readonly onChangeHeight: (h: number) => void;
  readonly onSelectPreset: (ratio: GeminiSupportedRatio) => void;
}

const RATIO_DIMENSIONS: Record<GeminiSupportedRatio, { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 },
  "1:4": { w: 256, h: 1024 },
  "1:8": { w: 128, h: 1024 },
  "2:3": { w: 683, h: 1024 },
  "3:2": { w: 1024, h: 683 },
  "3:4": { w: 768, h: 1024 },
  "4:1": { w: 1024, h: 256 },
  "4:3": { w: 1024, h: 768 },
  "4:5": { w: 819, h: 1024 },
  "5:4": { w: 1024, h: 819 },
  "8:1": { w: 1024, h: 128 },
  "9:16": { w: 576, h: 1024 },
  "16:9": { w: 1024, h: 576 },
  "21:9": { w: 1024, h: 439 },
};

export function FreeformRatioInput({
  width,
  height,
  onChangeWidth,
  onChangeHeight,
  onSelectPreset,
}: FreeformRatioInputProps) {
  const [showPresets, setShowPresets] = useState(false);

  function handlePreset(ratio: GeminiSupportedRatio) {
    const dims = RATIO_DIMENSIONS[ratio];
    onChangeWidth(dims.w);
    onChangeHeight(dims.h);
    onSelectPreset(ratio);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          value={width}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (v > 0) onChangeWidth(v);
          }}
          aria-label="Width"
          className="w-20"
        />
        <span className="text-muted-foreground">×</span>
        <Input
          type="number"
          min={1}
          value={height}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (v > 0) onChangeHeight(v);
          }}
          aria-label="Height"
          className="w-20"
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setShowPresets((prev) => !prev)}
      >
        {showPresets ? "Hide presets" : "Quick presets"}
      </Button>
      {showPresets && (
        <DiscreteRatioGrid
          value="1:1"
          onChange={handlePreset}
        />
      )}
    </div>
  );
}
