import type { NormalizedError, ErrorKind } from "@/lib/providers/errors";
import { toast } from "sonner";

type ErrorContext = "wizard" | "round" | "settings";

const RETRYABLE_KINDS: ReadonlySet<ErrorKind> = new Set([
  "rate_limited",
  "server_error",
  "network_error",
]);

export function isRetryable(err: NormalizedError): boolean {
  return RETRYABLE_KINDS.has(err.kind);
}

export function isAuthError(err: NormalizedError): boolean {
  return err.kind === "auth_failed";
}

export function isContentBlocked(err: NormalizedError): boolean {
  return err.kind === "content_blocked";
}

function networkDetail(err: NormalizedError): string {
  const msg = err.message.toLowerCase();
  if (msg.includes("dns") || msg.includes("resolve")) return "DNS resolution failed.";
  if (msg.includes("abort")) return "Request aborted.";
  if (msg.includes("timeout") || msg.includes("timed out")) return "Request timed out.";
  return "Network error.";
}

const MESSAGE_MAP: Record<ErrorKind, Record<ErrorContext, string | ((err: NormalizedError) => string)>> = {
  auth_failed: {
    wizard: "Re-check the key and try again.",
    round: "Invalid API key. Re-check in Settings.",
    settings: "Key rejected. Re-paste and re-test.",
  },
  rate_limited: {
    wizard: (err) =>
      err.retryAfterSeconds
        ? `Rate limited. Wait ${err.retryAfterSeconds}s and retry.`
        : "Rate limited. Wait a moment and retry.",
    round: (err) =>
      err.retryAfterSeconds
        ? `Rate limited. Wait ${err.retryAfterSeconds}s and retry.`
        : "Rate limited. Wait a moment and retry.",
    settings: (err) =>
      err.retryAfterSeconds
        ? `Rate limited. Wait ${err.retryAfterSeconds}s and retry.`
        : "Rate limited. Wait a moment and retry.",
  },
  bad_request: {
    wizard: "Validation failed.",
    round: "Validation failed. Try again.",
    settings: "Validation failed.",
  },
  content_blocked: {
    wizard: "Content blocked by safety filter.",
    round: "Content blocked by safety filter.",
    settings: "Content blocked by safety filter.",
  },
  server_error: {
    wizard: "Provider error. Try again.",
    round: "Provider error. Try again.",
    settings: "Provider error. Try again.",
  },
  network_error: {
    wizard: networkDetail,
    round: networkDetail,
    settings: networkDetail,
  },
  quota_exhausted: {
    wizard: "Quota exhausted. Add billing or wait for reset.",
    round: "Quota exhausted. Add billing or wait for reset.",
    settings: "Quota exhausted. Add billing or wait for reset.",
  },
  verification_required: {
    wizard: "This OpenAI model requires organization verification. Complete verification in your OpenAI dashboard.",
    round: "This OpenAI model requires organization verification. Complete verification in your OpenAI dashboard.",
    settings: "This OpenAI model requires organization verification. Complete verification in your OpenAI dashboard.",
  },
  unknown: {
    wizard: "Unexpected error. Try again.",
    round: "Unexpected error. Try again.",
    settings: "Unexpected error. Try again.",
  },
};

export function errorToMessage(err: NormalizedError, context: ErrorContext): string {
  const entry = MESSAGE_MAP[err.kind][context];
  return typeof entry === "function" ? entry(err) : entry;
}

export function useErrorToast(): (err: NormalizedError) => void {
  return (err: NormalizedError) => {
    toast.error(errorToMessage(err, "round"));
  };
}
