"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ImageCount } from "@/lib/providers/types";

const COUNTS: ImageCount[] = [4, 8, 16];

interface CapInfo {
  readonly ipm: number;
  readonly label: string;
}

interface ImageCountPickerProps {
  readonly value: ImageCount;
  readonly onChange: (count: ImageCount) => void;
  readonly caps?: readonly CapInfo[];
}

function buildCaption(count: ImageCount, caps: readonly CapInfo[]): string | null {
  if (caps.length === 0) return null;
  const effectiveCap = Math.min(...caps.map((c) => c.ipm));
  if (effectiveCap <= 0) return null;
  const fits = count <= effectiveCap;
  if (caps.length > 1) {
    return fits
      ? `Default cap: ${effectiveCap}/min combined. ${count}/round will fit.`
      : `You'll hit your cap on this — rounds will queue.`;
  }
  const single = caps[0];
  return fits
    ? `${single.label} cap: ${single.ipm}/min. ${count}/round will fit.`
    : `You'll hit your cap on this — rounds will queue.`;
}

export function ImageCountPicker({
  value,
  onChange,
  caps = [],
}: ImageCountPickerProps) {
  const caption = buildCaption(value, caps);

  return (
    <div className="space-y-1.5">
      <ToggleGroup
        value={[String(value)]}
        onValueChange={(values) => {
          const last = values[values.length - 1];
          if (last) onChange(Number(last) as ImageCount);
        }}
      >
        {COUNTS.map((c) => (
          <ToggleGroupItem key={c} value={String(c)} aria-label={`${c} images`}>
            {c}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {caption && (
        <p className="text-xs text-muted-foreground">{caption}</p>
      )}
    </div>
  );
}
