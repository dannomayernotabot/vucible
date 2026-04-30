"use client";

import { useCallback, useMemo, useState } from "react";
import { useRound, MAX_SELECTIONS } from "@/components/round/RoundProvider";
import { getStorage } from "@/lib/storage/keys";
import { ModelSection } from "./ModelSection";
import { CommentaryInput } from "@/components/round/CommentaryInput";
import { RateLimitBanner } from "@/components/feedback/RateLimitBanner";
import { ImageZoom } from "./ImageZoom";
import type { Provider } from "@/lib/providers/types";

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

function countSuccesses(results: readonly { status: string }[]): number {
  return results.filter((r) => r.status === "success").length;
}

export function ResultGrid() {
  const { round, isRunning, done, total, queued, selections, toggleSelection, regenerateSlot, evolveRound } =
    useRound();

  const [zoomState, setZoomState] = useState<{
    open: boolean;
    provider: Provider;
    index: number;
  }>({ open: false, provider: "openai", index: 0 });

  const handleZoom = useCallback((provider: Provider, index: number) => {
    setZoomState({ open: true, provider, index });
  }, []);

  const handleZoomOpenChange = useCallback((open: boolean) => {
    setZoomState((prev) => ({ ...prev, open }));
  }, []);

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

  const settled = !isRunning;
  const successCount = countSuccesses(round.openaiResults) + countSuccesses(round.geminiResults);
  const allErrors = settled && successCount === 0 && total > 0;

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

      <RateLimitBanner />

      <ModelSection
        roundId={round.id}
        provider="openai"
        results={round.openaiResults}
        selections={selections}
        onToggleSelection={toggleSelection}
        onRegenerate={regenerateSlot}
        onZoom={handleZoom}
      />
      <ModelSection
        roundId={round.id}
        provider="gemini"
        results={round.geminiResults}
        selections={selections}
        onToggleSelection={toggleSelection}
        onRegenerate={regenerateSlot}
        onZoom={handleZoom}
      />

      {settled && successCount > 0 && <CommentaryInput />}

      {settled && successCount > 0 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Selected: {selections.length}/{MAX_SELECTIONS}
          </p>
          <button
            type="button"
            disabled={selections.length === 0}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              selections.length === 0
                ? "Pick 1-4 favorites to continue"
                : undefined
            }
            onClick={() =>
              evolveRound({
                modelsEnabled: round.modelsEnabled,
                count: round.imageCount,
                aspect: round.aspect,
              })
            }
          >
            Evolve
          </button>
        </div>
      )}

      {allErrors && (
        <p className="text-sm text-muted-foreground" role="status">
          All cards failed — regenerate or start a new prompt
        </p>
      )}

      <ImageZoom
        roundId={round.id}
        openaiResults={round.openaiResults}
        geminiResults={round.geminiResults}
        initialProvider={zoomState.provider}
        initialIndex={zoomState.index}
        open={zoomState.open}
        onOpenChange={handleZoomOpenChange}
      />
    </div>
  );
}
