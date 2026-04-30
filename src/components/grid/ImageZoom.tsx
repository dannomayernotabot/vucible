"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { imageCache } from "@/lib/round/image-cache";
import type { RoundResult } from "@/lib/storage/schema";
import type { Provider } from "@/lib/providers/types";

interface SuccessSlot {
  provider: Provider;
  index: number;
  bytes: ArrayBuffer;
  mimeType: string;
}

interface ImageZoomProps {
  readonly roundId: string;
  readonly openaiResults: readonly RoundResult[];
  readonly geminiResults: readonly RoundResult[];
  readonly initialProvider: Provider;
  readonly initialIndex: number;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function ImageZoom({
  roundId,
  openaiResults,
  geminiResults,
  initialProvider,
  initialIndex,
  open,
  onOpenChange,
}: ImageZoomProps) {
  const slots = useMemo(() => {
    const s: SuccessSlot[] = [];
    for (let i = 0; i < openaiResults.length; i++) {
      const r = openaiResults[i];
      if (r.status === "success") {
        s.push({ provider: "openai", index: i, bytes: r.bytes, mimeType: r.mimeType });
      }
    }
    for (let i = 0; i < geminiResults.length; i++) {
      const r = geminiResults[i];
      if (r.status === "success") {
        s.push({ provider: "gemini", index: i, bytes: r.bytes, mimeType: r.mimeType });
      }
    }
    return s;
  }, [openaiResults, geminiResults]);

  const initialSlotIndex = useMemo(
    () =>
      slots.findIndex(
        (s) => s.provider === initialProvider && s.index === initialIndex,
      ),
    [slots, initialProvider, initialIndex],
  );

  const [current, setCurrent] = useState(Math.max(0, initialSlotIndex));

  useEffect(() => {
    if (open) {
      setCurrent(Math.max(0, initialSlotIndex));
    }
  }, [open, initialSlotIndex]);

  const slot = slots[current];
  const slotKey = slot ? `${roundId}:${slot.provider}:${slot.index}` : "";

  const url = useMemo(() => {
    if (!slot) return null;
    return imageCache.get(roundId, slotKey, slot.bytes, slot.mimeType);
  }, [roundId, slotKey, slot]);

  useEffect(() => {
    if (!slot) return;
    return () => {
      imageCache.release(roundId, slotKey);
    };
  }, [roundId, slotKey, slot]);

  const prev = useCallback(() => {
    setCurrent((c) => (c > 0 ? c - 1 : slots.length - 1));
  }, [slots.length]);

  const next = useCallback(() => {
    setCurrent((c) => (c < slots.length - 1 ? c + 1 : 0));
  }, [slots.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, prev, next]);

  if (slots.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl p-0 overflow-hidden"
        showCloseButton
      >
        <DialogTitle className="sr-only">
          Image {current + 1} of {slots.length}
        </DialogTitle>
        {url && (
          <img
            src={url}
            alt={`Full size image ${current + 1} of ${slots.length}`}
            className="h-auto w-full"
          />
        )}
        {slots.length > 1 && (
          <div className="absolute inset-y-0 flex w-full items-center justify-between px-2 pointer-events-none">
            <Button
              variant="secondary"
              size="icon-sm"
              className="pointer-events-auto rounded-full opacity-80 hover:opacity-100"
              onClick={prev}
              aria-label="Previous image"
            >
              &#8592;
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              className="pointer-events-auto rounded-full opacity-80 hover:opacity-100"
              onClick={next}
              aria-label="Next image"
            >
              &#8594;
            </Button>
          </div>
        )}
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground">
          {current + 1} / {slots.length}
        </p>
      </DialogContent>
    </Dialog>
  );
}
