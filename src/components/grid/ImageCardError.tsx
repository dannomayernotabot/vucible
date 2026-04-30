"use client";

import type { NormalizedError } from "@/lib/providers/errors";
import { errorToMessage } from "@/lib/round/failures";

interface ImageCardErrorProps {
  readonly error: NormalizedError;
}

export function ImageCardError({ error }: ImageCardErrorProps) {
  const message = errorToMessage(error, "round");

  return (
    <div
      className="flex aspect-square items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-4"
      role="alert"
    >
      <p className="text-center text-sm text-destructive">{message}</p>
    </div>
  );
}
