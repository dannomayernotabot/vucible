"use client";

import { DiscreteRatioGrid } from "./parts/DiscreteRatioGrid";
import { FreeformRatioInput } from "./parts/FreeformRatioInput";
import type { AspectRatioConfig, GeminiSupportedRatio } from "@/lib/providers/types";

interface AspectRatioPickerProps {
  readonly geminiEnabled: boolean;
  readonly value: AspectRatioConfig;
  readonly onChange: (value: AspectRatioConfig) => void;
}

export function AspectRatioPicker({
  geminiEnabled,
  value,
  onChange,
}: AspectRatioPickerProps) {
  if (geminiEnabled) {
    const currentRatio: GeminiSupportedRatio =
      value.kind === "discrete" ? value.ratio : "1:1";

    return (
      <DiscreteRatioGrid
        value={currentRatio}
        onChange={(ratio) => onChange({ kind: "discrete", ratio })}
      />
    );
  }

  const currentWidth = value.kind === "freeform" ? value.width : 1024;
  const currentHeight = value.kind === "freeform" ? value.height : 1024;

  return (
    <FreeformRatioInput
      width={currentWidth}
      height={currentHeight}
      onChangeWidth={(w) =>
        onChange({ kind: "freeform", width: w, height: currentHeight })
      }
      onChangeHeight={(h) =>
        onChange({ kind: "freeform", width: currentWidth, height: h })
      }
      onSelectPreset={(ratio) => onChange({ kind: "discrete", ratio })}
    />
  );
}
