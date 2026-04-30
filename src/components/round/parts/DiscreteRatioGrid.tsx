"use client";

import { cn } from "@/lib/utils";
import type { GeminiSupportedRatio } from "@/lib/providers/types";

const RATIOS: GeminiSupportedRatio[] = [
  "1:1", "3:2", "2:3", "3:4", "4:3",
  "4:5", "5:4", "9:16", "16:9", "21:9",
];

function ratioToSize(ratio: string): { w: number; h: number } {
  const [a, b] = ratio.split(":").map(Number);
  const scale = 32 / Math.max(a, b);
  return { w: Math.round(a * scale), h: Math.round(b * scale) };
}

interface DiscreteRatioGridProps {
  readonly value: GeminiSupportedRatio;
  readonly onChange: (ratio: GeminiSupportedRatio) => void;
}

export function DiscreteRatioGrid({ value, onChange }: DiscreteRatioGridProps) {
  return (
    <div
      className="grid grid-cols-5 gap-2"
      role="radiogroup"
      aria-label="Aspect ratio"
    >
      {RATIOS.map((ratio) => {
        const { w, h } = ratioToSize(ratio);
        const selected = ratio === value;
        return (
          <button
            key={ratio}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={ratio}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition-colors",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-muted-foreground/50",
            )}
            onClick={() => onChange(ratio)}
          >
            <div
              className={cn(
                "rounded-sm",
                selected ? "bg-primary" : "bg-muted-foreground/30",
              )}
              style={{ width: w, height: h }}
            />
            <span>{ratio}</span>
          </button>
        );
      })}
    </div>
  );
}
