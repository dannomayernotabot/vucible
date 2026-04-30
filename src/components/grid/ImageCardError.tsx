"use client";

import type { NormalizedError } from "@/lib/providers/errors";
import { errorToMessage, isRetryable } from "@/lib/round/failures";
import { Button } from "@/components/ui/button";

interface ImageCardErrorProps {
  readonly error: NormalizedError;
  readonly onRegenerate?: () => void;
}

export function ImageCardError({ error, onRegenerate }: ImageCardErrorProps) {
  const message = errorToMessage(error, "round");
  const canRetry = isRetryable(error);

  return (
    <div
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
      role="alert"
    >
      <p className="text-center text-sm text-destructive">{message}</p>
      {canRetry && onRegenerate && (
        <Button variant="outline" size="sm" onClick={onRegenerate}>
          Regenerate
        </Button>
      )}
    </div>
  );
}
