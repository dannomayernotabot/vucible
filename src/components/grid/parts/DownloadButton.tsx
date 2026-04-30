"use client";

import { useCallback } from "react";
import { Download } from "lucide-react";
import { useRound } from "@/components/round/RoundProvider";
import { parseSlotKey } from "@/lib/round/slot-key";
import { buildFilename, triggerDownload } from "@/lib/round/download";

interface DownloadButtonProps {
  readonly bytes: ArrayBuffer;
  readonly mimeType: string;
  readonly slotKey: string;
}

export function DownloadButton({ bytes, mimeType, slotKey }: DownloadButtonProps) {
  const { round } = useRound();

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!round) return;
      const parsed = parseSlotKey(slotKey);
      const slotIndex = parsed?.index ?? 0;
      const filename = buildFilename(round.sessionId ?? round.id, round.number, slotIndex, mimeType);
      const blob = new Blob([bytes], { type: mimeType });
      triggerDownload(blob, filename);
    },
    [round, bytes, mimeType, slotKey],
  );

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="absolute bottom-2 right-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
      aria-label="Download image"
      title="Download image"
    >
      <Download className="h-4 w-4" />
    </button>
  );
}
