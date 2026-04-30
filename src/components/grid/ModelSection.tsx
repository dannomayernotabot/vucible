"use client";

import { useCallback } from "react";
import type { Provider } from "@/lib/providers/types";
import type { RoundResult } from "@/lib/storage/schema";
import type { Selection } from "@/components/round/RoundProvider";
import { ImageCard } from "./ImageCard";
import { slotKey } from "@/lib/round/slot-key";
import { MAX_SELECTIONS } from "@/components/round/RoundProvider";

const LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
};

interface ModelSectionProps {
  readonly roundId: string;
  readonly provider: Provider;
  readonly results: readonly RoundResult[];
  readonly selections: readonly Selection[];
  readonly onToggleSelection: (provider: Provider, index: number) => void;
  readonly onRegenerate: (provider: Provider, index: number) => void;
}

export function ModelSection({
  roundId,
  provider,
  results,
  selections,
  onToggleSelection,
  onRegenerate,
}: ModelSectionProps) {
  if (results.length === 0) return null;

  const atMax = selections.length >= MAX_SELECTIONS;

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
        {LABELS[provider]} &middot; {results.length} images
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {results.map((result, index) => {
          const key = slotKey(roundId, provider, index);
          const selIdx = selections.findIndex(
            (s) => s.provider === provider && s.index === index,
          );
          return (
            <ImageCard
              key={key}
              roundId={roundId}
              slotKey={key}
              result={result}
              selected={selIdx >= 0}
              selectionIndex={selIdx >= 0 ? selIdx : null}
              atMax={atMax}
              onToggleSelection={() => onToggleSelection(provider, index)}
              onRegenerate={() => onRegenerate(provider, index)}
            />
          );
        })}
      </div>
    </section>
  );
}
