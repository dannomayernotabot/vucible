"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Round } from "@/lib/storage/schema";
import { getRound } from "@/lib/storage/history";
import { ImageCardSuccess } from "@/components/grid/ImageCardSuccess";
import { ImageCardError } from "@/components/grid/ImageCardError";
import { slotKey } from "@/lib/round/slot-key";
import type { Provider } from "@/lib/providers/types";

interface ScrollBackPanelProps {
  readonly roundId: string;
  readonly onClose: () => void;
}

export function ScrollBackPanel({ roundId, onClose }: ScrollBackPanelProps) {
  const [round, setRound] = useState<Round | null>(null);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getRound(roundId).then((r) => setRound(r ?? null));
  }, [roundId]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [round]);

  if (!round) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading round...</div>
    );
  }

  return (
    <div ref={panelRef} className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Round {round.number} (read-only)
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
          aria-label="Back to current round"
        >
          Back to current
        </button>
      </div>

      {round.promptSent && (
        <p className="text-xs text-muted-foreground italic">
          {round.promptSent.length > 100
            ? round.promptSent.slice(0, 100) + "..."
            : round.promptSent}
        </p>
      )}

      {visible && (
        <>
          <SlotGrid
            roundId={round.id}
            provider="openai"
            results={round.openaiResults}
          />
          <SlotGrid
            roundId={round.id}
            provider="gemini"
            results={round.geminiResults}
          />
        </>
      )}

      {round.commentary && (
        <p className="text-xs text-muted-foreground">
          Commentary: {round.commentary}
        </p>
      )}
    </div>
  );
}

function SlotGrid({
  roundId,
  provider,
  results,
}: {
  roundId: string;
  provider: Provider;
  results: readonly import("@/lib/storage/schema").RoundResult[];
}) {
  if (results.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {results.map((result, index) => {
        const key = slotKey(roundId, provider, index);
        if (result.status === "success") {
          return (
            <ImageCardSuccess
              key={key}
              roundId={roundId}
              slotKey={key}
              bytes={result.bytes}
              mimeType={result.mimeType}
            />
          );
        }
        if (result.status === "error") {
          return <ImageCardError key={key} error={result.error} />;
        }
        return null;
      })}
    </div>
  );
}
