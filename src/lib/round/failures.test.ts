import { describe, expect, it, vi, afterEach } from "vitest";
import {
  errorToMessage,
  isRetryable,
  isAuthError,
  isContentBlocked,
  useErrorToast,
} from "./failures";
import type { NormalizedError, ErrorKind } from "@/lib/providers/errors";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

function makeError(kind: ErrorKind, overrides: Partial<NormalizedError> = {}): NormalizedError {
  return { kind, message: "test error", ...overrides };
}

const CONTEXTS = ["wizard", "round", "settings"] as const;
const ALL_KINDS: ErrorKind[] = [
  "auth_failed",
  "rate_limited",
  "bad_request",
  "content_blocked",
  "server_error",
  "network_error",
  "quota_exhausted",
  "verification_required",
  "unknown",
];

describe("errorToMessage", () => {
  it.each(
    ALL_KINDS.flatMap((kind) =>
      CONTEXTS.map((ctx) => ({ kind, ctx })),
    ),
  )("returns a non-empty string for $kind / $ctx", ({ kind, ctx }) => {
    const msg = errorToMessage(makeError(kind), ctx);
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });

  it("auth_failed wizard says re-check", () => {
    expect(errorToMessage(makeError("auth_failed"), "wizard")).toContain("Re-check");
  });

  it("auth_failed round says Settings", () => {
    expect(errorToMessage(makeError("auth_failed"), "round")).toContain("Settings");
  });

  it("auth_failed settings says re-paste", () => {
    expect(errorToMessage(makeError("auth_failed"), "settings")).toContain("Re-paste");
  });

  it("rate_limited includes retryAfterSeconds when present", () => {
    const err = makeError("rate_limited", { retryAfterSeconds: 30 });
    expect(errorToMessage(err, "round")).toContain("30s");
  });

  it("rate_limited without retryAfterSeconds says wait a moment", () => {
    const err = makeError("rate_limited");
    expect(errorToMessage(err, "round")).toContain("Wait a moment");
  });

  it("network_error distinguishes DNS", () => {
    const err = makeError("network_error", { message: "dns resolution failed" });
    expect(errorToMessage(err, "round")).toContain("DNS");
  });

  it("network_error distinguishes timeout", () => {
    const err = makeError("network_error", { message: "request timed out" });
    expect(errorToMessage(err, "round")).toContain("timed out");
  });

  it("network_error distinguishes abort", () => {
    const err = makeError("network_error", { message: "abort signal" });
    expect(errorToMessage(err, "round")).toContain("aborted");
  });

  it("verification_required mentions organization verification", () => {
    const err = makeError("verification_required");
    expect(errorToMessage(err, "wizard")).toContain("organization verification");
    expect(errorToMessage(err, "round")).toContain("organization verification");
    expect(errorToMessage(err, "settings")).toContain("organization verification");
  });
});

describe("predicates", () => {
  it("isRetryable returns true for rate_limited, server_error, network_error", () => {
    expect(isRetryable(makeError("rate_limited"))).toBe(true);
    expect(isRetryable(makeError("server_error"))).toBe(true);
    expect(isRetryable(makeError("network_error"))).toBe(true);
  });

  it("isRetryable returns false for non-retryable kinds", () => {
    expect(isRetryable(makeError("auth_failed"))).toBe(false);
    expect(isRetryable(makeError("content_blocked"))).toBe(false);
    expect(isRetryable(makeError("quota_exhausted"))).toBe(false);
    expect(isRetryable(makeError("unknown"))).toBe(false);
    expect(isRetryable(makeError("bad_request"))).toBe(false);
  });

  it("isAuthError returns true only for auth_failed", () => {
    expect(isAuthError(makeError("auth_failed"))).toBe(true);
    expect(isAuthError(makeError("unknown"))).toBe(false);
  });

  it("isContentBlocked returns true only for content_blocked", () => {
    expect(isContentBlocked(makeError("content_blocked"))).toBe(true);
    expect(isContentBlocked(makeError("unknown"))).toBe(false);
  });
});

describe("useErrorToast", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls toast.error with the mapped message", async () => {
    const { toast } = await import("sonner");
    const showToast = useErrorToast();
    showToast(makeError("auth_failed"));
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid API key"),
    );
  });
});
