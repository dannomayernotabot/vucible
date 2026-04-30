"use client";

import { useMemo } from "react";
import { useRound } from "@/components/round/RoundProvider";
import { getStorage } from "@/lib/storage/keys";
import { ModelSection } from "./ModelSection";

const P50_GEN_LATENCY_S = 18;

function estimateQueueTime(slotCount: number, ipm: number): number {
  return Math.ceil(slotCount / ipm) * 60 + P50_GEN_LATENCY_S;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function ResultGrid() {
  const { round, isRunning, done, total, queued } = useRound();

  const longRoundBanner = useMemo(() => {
    if (!round || !isRunning) return null;
    const storage = getStorage();
    if (!storage) return null;

    const openaiConfig = storage.providers.openai;
    if (!openaiConfig || openaiConfig.tier !== "tier1") return null;
    if (round.imageCount < 16) return null;

    const estimate = estimateQueueTime(
      round.openaiResults.length,
      openaiConfig.ipm,
    );
    return `Tier 1 throttle: estimated ${formatDuration(estimate)}. Lower the per-round count for faster rounds.`;
  }, [round, isRunning]);

  if (!round) return null;

  return (
    <div className="space-y-6 p-4">
      {isRunning && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground" role="status">
            {done} of {total} complete
            {queued > 0 && ` · ${queued} waiting`}
          </p>
          {longRoundBanner && (
            <p className="text-xs text-muted-foreground/70" role="note">
              {longRoundBanner}
            </p>
          )}
        </div>
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
