"use client";

import type { Provider } from "@/lib/providers/types";
import type { RoundResult } from "@/lib/storage/schema";
import { ImageCard } from "./ImageCard";
import { slotKey } from "@/lib/round/slot-key";

const LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
};

interface ModelSectionProps {
  readonly roundId: string;
  readonly provider: Provider;
  readonly results: readonly RoundResult[];
}

export function ModelSection({
  roundId,
  provider,
  results,
}: ModelSectionProps) {
  if (results.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
        {LABELS[provider]} &middot; {results.length} images
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {results.map((result, index) => {
          const key = slotKey(roundId, provider, index);
          return (
            <ImageCard
              key={key}
              roundId={roundId}
              slotKey={key}
              result={result}
            />
          );
        })}
      </div>
    </section>
  );
}
