"use client";

import { useRound } from "@/components/round/RoundProvider";
import { ModelSection } from "./ModelSection";

export function ResultGrid() {
  const { round, isRunning, done, total, queued } = useRound();

  if (!round) return null;

  return (
    <div className="space-y-6 p-4">
      {isRunning && (
        <p className="text-sm text-muted-foreground" role="status">
          {done} of {total} complete
          {queued > 0 && " · " + queued + " waiting"}
        </p>
      )}

      <ModelSection
        roundId={round.id}
        provider="openai"
        results={round.openaiResults}
      />
      <ModelSection
        roundId={round.id}
        provider="gemini"
        results={round.geminiResults}
      />
    </div>
  );
}
