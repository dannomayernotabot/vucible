"use client";

import { useEffect, useMemo } from "react";
import { imageCache } from "@/lib/round/image-cache";

interface ImageCardSuccessProps {
  readonly roundId: string;
  readonly slotKey: string;
  readonly bytes: ArrayBuffer;
  readonly mimeType: string;
}

export function ImageCardSuccess({
  roundId,
  slotKey,
  bytes,
  mimeType,
}: ImageCardSuccessProps) {
  const url = useMemo(
    () => imageCache.get(roundId, slotKey, bytes, mimeType),
    [roundId, slotKey, bytes, mimeType],
  );

  useEffect(() => {
    return () => {
      imageCache.release(roundId, slotKey);
    };
  }, [roundId, slotKey]);

  if (!url) return null;

  return (
    <div className="overflow-hidden rounded-lg">
      <img
        src={url}
        alt="Generated image"
        className="h-auto w-full"
        loading="lazy"
      />
    </div>
  );
}
