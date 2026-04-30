"use client";

import type { RoundResult } from "@/lib/storage/schema";
import { ImageCardLoading } from "./ImageCardLoading";
import { ImageCardSuccess } from "./ImageCardSuccess";
import { ImageCardError } from "./ImageCardError";
import { SelectionOverlay } from "./SelectionOverlay";

interface ImageCardProps {
  readonly roundId: string;
  readonly slotKey: string;
  readonly result: RoundResult;
  readonly selected: boolean;
  readonly selectionIndex: number | null;
  readonly atMax: boolean;
  readonly onToggleSelection: () => void;
  readonly onRegenerate?: () => void;
  readonly onZoom?: () => void;
}

export function ImageCard({
  roundId,
  slotKey,
  result,
  selected,
  selectionIndex,
  atMax,
  onToggleSelection,
  onRegenerate,
  onZoom,
}: ImageCardProps) {
  switch (result.status) {
    case "loading":
      return <ImageCardLoading />;
    case "success":
      return (
        <SelectionOverlay
          selected={selected}
          selectionIndex={selectionIndex}
          disabled={false}
          atMax={atMax}
          onToggle={onToggleSelection}
        >
          <ImageCardSuccess
            roundId={roundId}
            slotKey={slotKey}
            bytes={result.bytes}
            mimeType={result.mimeType}
            onZoom={onZoom}
          />
        </SelectionOverlay>
      );
    case "error":
      return <ImageCardError error={result.error} onRegenerate={onRegenerate} />;
  }
}
