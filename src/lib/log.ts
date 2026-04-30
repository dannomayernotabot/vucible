// Trauma-guard rule: NEVER pass api keys, raw response bodies, or image bytes to logEvent.
// Only IDs, kinds, counts, and ms. redact() strips protected fields as defense-in-depth.

import type { ErrorKind } from "@/lib/providers/errors";

export type LogEvent =
  | "wizard.validate.start"
  | "wizard.validate.success"
  | "wizard.validate.error"
  | "wizard.complete"
  | "round.start"
  | "round.slot.success"
  | "round.slot.error"
  | "round.settle"
  | "round.retry"
  | "round.aborted"
  | "throttle.queued"
  | "throttle.released"
  | "throttle.cap.changed"
  | "storage.write"
  | "storage.migrate"
  | "storage.purge"
  | "storage.quota.exceeded"
  | "history.write"
  | "history.read"
  | "history.purge"
  | "history.orphan.swept"
  | "cache.evict"
  | "cache.overflow.warn"
  | "bfcache.restored";

export interface LogCtx {
  event: LogEvent;
  level?: "debug" | "info" | "warn" | "error";
  roundId?: string;
  slotId?: string;
  sessionId?: string;
  provider?: "openai" | "gemini";
  errorKind?: ErrorKind;
  ms?: number;
  [k: string]: unknown;
}

const PROTECTED_FIELDS = ["apiKey", "key", "authorization"];

export function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...obj };
  for (const field of PROTECTED_FIELDS) {
    delete result[field];
  }
  return result;
}

export function logEvent(ctx: LogCtx): void {
  const { event, level = "info", ...rest } = ctx;
  const safe = redact(rest as Record<string, unknown>);
  const line = `vucible[${event}] ${JSON.stringify(safe)}`;
  switch (level) {
    case "debug":
      console.debug(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
    default:
      console.log(line);
  }
}
