"use client";

import { useCallback } from "react";
import { Download } from "lucide-react";
import { useRound } from "@/components/round/RoundProvider";
import { parseSlotKey } from "@/lib/round/slot-key";
import { buildFilename, triggerDownload } from "@/lib/round/download";

interface DownloadButtonProps {
  readonly slotKey: string;
  readonly bytes: ArrayBuffer;
  readonly mimeType: string;
}

export function DownloadButton({ slotKey, bytes, mimeType }: DownloadButtonProps) {
  const { round, sessionId } = useRound();

  const handleClick = useCallback(() => {
    if (!round || !sessionId) return;
    const parsed = parseSlotKey(slotKey);
    if (!parsed) return;
    const filename = buildFilename(sessionId, round.number, parsed.index, mimeType);
    const blob = new Blob([bytes], { type: mimeType });
    triggerDownload(blob, filename);
  }, [slotKey, bytes, mimeType, round, sessionId]);

  return (
    <button
      type="button"
      className="rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
      onClick={handleClick}
      aria-label="Download image"
    >
      <Download className="h-4 w-4" />
    </button>
  );
}
