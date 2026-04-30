"use client";

import type { RoundResult } from "@/lib/storage/schema";
import { ImageCardLoading } from "./ImageCardLoading";
import { ImageCardSuccess } from "./ImageCardSuccess";
import { ImageCardError } from "./ImageCardError";

interface ImageCardProps {
  readonly roundId: string;
  readonly slotKey: string;
  readonly result: RoundResult;
  readonly onRegenerate?: () => void;
}

export function ImageCard({ roundId, slotKey, result, onRegenerate }: ImageCardProps) {
  switch (result.status) {
    case "loading":
      return <ImageCardLoading />;
    case "success":
      return (
        <ImageCardSuccess
          roundId={roundId}
          slotKey={slotKey}
          bytes={result.bytes}
          mimeType={result.mimeType}
        />
      );
    case "error":
      return <ImageCardError error={result.error} onRegenerate={onRegenerate} />;
  }
}
