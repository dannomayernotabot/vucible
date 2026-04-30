"use client";

import { useEffect, useMemo } from "react";
import type { Round, RoundResult } from "@/lib/storage/schema";
import { thumbnailCache } from "@/lib/round/image-cache";
import { slotKey } from "@/lib/round/slot-key";
import type { Provider } from "@/lib/providers/types";

interface RoundCardProps {
  readonly round: Round;
  readonly isActive: boolean;
  readonly onClick: () => void;
}

function thumbUrl(
  roundId: string,
  provider: Provider,
  index: number,
  result: RoundResult,
): string | null {
  if (result.status !== "success") return null;
  const key = slotKey(roundId, provider, index);
  return thumbnailCache.get(roundId, key, result.thumbnail, result.mimeType);
}

export function RoundCard({ round, isActive, onClick }: RoundCardProps) {
  const thumbs = useMemo(() => {
    const items: { key: string; url: string | null; status: RoundResult["status"] }[] = [];
    for (let i = 0; i < round.openaiResults.length; i++) {
      const r = round.openaiResults[i];
      items.push({
        key: slotKey(round.id, "openai", i),
        url: thumbUrl(round.id, "openai", i, r),
        status: r.status,
      });
    }
    for (let i = 0; i < round.geminiResults.length; i++) {
      const r = round.geminiResults[i];
      items.push({
        key: slotKey(round.id, "gemini", i),
        url: thumbUrl(round.id, "gemini", i, r),
        status: r.status,
      });
    }
    return items;
  }, [round]);

  useEffect(() => {
    return () => {
      for (const t of thumbs) {
        if (t.url) {
          thumbnailCache.release(round.id, t.key);
        }
      }
    };
  }, [round.id, thumbs]);

  const successCount = thumbs.filter((t) => t.status === "success").length;
  const errorCount = thumbs.filter((t) => t.status === "error" || t.status === "loading").length;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md border p-2 text-left transition-colors hover:bg-accent ${
        isActive ? "border-primary bg-accent" : "border-border"
      }`}
      aria-label={`Round ${round.number}`}
      aria-current={isActive ? "true" : undefined}
    >
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        Round {round.number}
        {successCount > 0 && ` · ${successCount} images`}
        {errorCount > 0 && ` · ${errorCount} failed`}
      </p>
      <div className="grid grid-cols-4 gap-0.5">
        {thumbs.slice(0, 8).map((t) => (
          <div
            key={t.key}
            className="aspect-square overflow-hidden rounded-sm bg-muted"
          >
            {t.url ? (
              <img
                src={t.url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : t.status === "error" || t.status === "loading" ? (
              <div className="flex h-full w-full items-center justify-center text-[8px] text-destructive/50">
                {t.status === "error" ? "!" : ""}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </button>
  );
}
