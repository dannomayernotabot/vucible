import type { NormalizedError } from "@/lib/providers/errors";
import { isRetryable } from "./failures";

export const MAX_RETRY_AFTER_MS = 60_000;

const BASE_DELAY_MS = 1000;
const MAX_JITTER_MS = 250;

function isNormalizedError(err: unknown): err is NormalizedError {
  return (
    typeof err === "object" &&
    err !== null &&
    "kind" in err &&
    "message" in err
  );
}

function jitteredBackoff(attempt: number): number {
  return BASE_DELAY_MS * 2 ** attempt + Math.random() * MAX_JITTER_MS;
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("The operation was aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("The operation was aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: { signal: AbortSignal; maxAttempts?: number },
): Promise<T> {
  const { signal, maxAttempts = 3 } = opts;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(signal);
    } catch (err) {
      lastError = err;

      if (signal.aborted) throw err;
      if (!isNormalizedError(err) || !isRetryable(err)) throw err;
      if (attempt === maxAttempts - 1) throw err;

      const retryAfterMs =
        err.retryAfterSeconds != null
          ? err.retryAfterSeconds * 1000
          : undefined;

      if (retryAfterMs != null && retryAfterMs > MAX_RETRY_AFTER_MS) throw err;

      const delayMs = retryAfterMs ?? jitteredBackoff(attempt);
      await abortableDelay(delayMs, signal);
    }
  }

  throw lastError;
}
