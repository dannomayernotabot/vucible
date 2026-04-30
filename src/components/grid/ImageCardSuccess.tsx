"use client";

import { useEffect, useMemo } from "react";
import { imageCache } from "@/lib/round/image-cache";
import { DownloadButton } from "./DownloadButton";
import { Maximize2 } from "lucide-react";

interface ImageCardSuccessProps {
  readonly roundId: string;
  readonly slotKey: string;
  readonly bytes: ArrayBuffer;
  readonly mimeType: string;
  readonly onZoom?: () => void;
}

export function ImageCardSuccess({
  roundId,
  slotKey,
  bytes,
  mimeType,
  onZoom,
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
    <div className="group relative animate-in fade-in duration-300 overflow-hidden rounded-lg motion-reduce:animate-none">
      <img
        src={url}
        alt="Generated image"
        className="h-auto w-full"
        loading="lazy"
      />
      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {onZoom && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onZoom();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 hover:bg-background"
            aria-label="Zoom image"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
        <DownloadButton slotKey={slotKey} bytes={bytes} mimeType={mimeType} />
      </div>
    </div>
  );
}
