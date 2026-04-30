/**
 * @vitest-environment jsdom
 *
 * Cross-validates the full error chain: mock provider error → orchestrate →
 * resulting error kind → copy string → retryability classification.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { startRoundOne, fanOut } from "./orchestrate";
import { resetDbSingleton } from "@/lib/storage/history";
import { ProviderThrottle } from "./throttle";
import { errorToMessage } from "./failures";
import { isRetryable } from "./failures";
import type { NormalizedError } from "@/lib/providers/errors";
import type { RoundResult } from "@/lib/storage/schema";

const mockOpenaiGenerate = vi.fn();
const mockGeminiGenerate = vi.fn();

vi.mock("@/lib/providers/openai", () => ({
  generate: (...args: unknown[]) => mockOpenaiGenerate(...args),
}));

vi.mock("@/lib/providers/gemini", () => ({
  generate: (...args: unknown[]) => mockGeminiGenerate(...args),
}));

vi.mock("./thumbnails", () => ({
  generateThumbnail: vi.fn(async (bytes: ArrayBuffer) => ({
    thumbnail: bytes,
    mimeType: "image/jpeg" as const,
  })),
}));

vi.mock("@/lib/storage/keys", () => ({
  getStorage: vi.fn().mockReturnValue({
    schemaVersion: 1,
    providers: {
      openai: {
        apiKey: "sk-test",
        tier: "tier2",
        ipm: 20,
        concurrencyCap: 20,
        validatedAt: new Date().toISOString(),
      },
      gemini: {
        apiKey: "AIzaTest",
        tier: "tier1",
        ipm: 5,
        concurrencyCap: 5,
        validatedAt: new Date().toISOString(),
      },
    },
    defaults: {
      imageCount: 8,
      aspectRatio: { kind: "discrete", ratio: "1:1" },
      theme: "system",
    },
    createdAt: new Date().toISOString(),
  }),
  setStorage: vi.fn(),
}));

function errorResult(error: NormalizedError) {
  return { ok: false as const, error };
}

function extractErrors(results: readonly RoundResult[]): NormalizedError[] {
  return results
    .filter((r): r is Extract<RoundResult, { status: "error" }> => r.status === "error")
    .map((r) => r.error);
}

async function runWithError(error: NormalizedError) {
  mockOpenaiGenerate.mockResolvedValue(errorResult(error));
  const { round } = await startRoundOne({
    prompt: "fault test",
    modelsEnabled: { openai: true, gemini: false },
    count: 4,
    aspect: { kind: "discrete", ratio: "1:1" },
  });
  const settled = await fanOut({
    round,
    signal: new AbortController().signal,
    throttles: { openai: new ProviderThrottle(20) },
    onSlotUpdate: () => {},
  });
  return extractErrors(settled.openaiResults);
}

beforeEach(async () => {
  await resetDbSingleton();
  mockOpenaiGenerate.mockReset();
  mockGeminiGenerate.mockReset();
});

describe("fault injection: error chain validation", () => {
  it("401 auth_failed → correct copy, not retryable", async () => {
    const errors = await runWithError({
      kind: "auth_failed",
      message: "Unauthorized",
      httpStatus: 401,
    });
    expect(errors.every((e) => e.kind === "auth_failed")).toBe(true);
    expect(errorToMessage(errors[0], "round")).toBe(
      "Invalid API key. Re-check in Settings.",
    );
    expect(isRetryable(errors[0])).toBe(false);
  });

  it("429 rate_limited with retryAfter → correct copy, retryable", () => {
    const err: NormalizedError = {
      kind: "rate_limited",
      message: "Too many requests",
      httpStatus: 429,
      retryAfterSeconds: 30,
    };
    expect(errorToMessage(err, "round")).toBe(
      "Rate limited. Wait 30s and retry.",
    );
    expect(isRetryable(err)).toBe(true);
  });

  it("429 rate_limited without retryAfter → generic copy", () => {
    const err: NormalizedError = {
      kind: "rate_limited",
      message: "Rate limit exceeded",
      httpStatus: 429,
    };
    expect(errorToMessage(err, "round")).toBe(
      "Rate limited. Wait a moment and retry.",
    );
    expect(isRetryable(err)).toBe(true);
  });

  it("content_blocked → correct copy, not retryable", async () => {
    const errors = await runWithError({
      kind: "content_blocked",
      message: "Safety filter triggered",
      httpStatus: 400,
    });
    expect(errors.every((e) => e.kind === "content_blocked")).toBe(true);
    expect(errorToMessage(errors[0], "round")).toBe(
      "Content blocked by safety filter.",
    );
    expect(isRetryable(errors[0])).toBe(false);
  });

  it("server_error → retryable, correct copy", () => {
    const err: NormalizedError = {
      kind: "server_error",
      message: "Internal error",
      httpStatus: 500,
    };
    expect(errorToMessage(err, "round")).toBe("Provider error. Try again.");
    expect(isRetryable(err)).toBe(true);
  });

  it("network_error with DNS message → DNS-specific copy", () => {
    const err: NormalizedError = {
      kind: "network_error",
      message: "DNS resolution failed for api.openai.com",
    };
    expect(errorToMessage(err, "round")).toBe("DNS resolution failed.");
    expect(isRetryable(err)).toBe(true);
  });

  it("network_error with timeout message → timeout-specific copy", () => {
    const err: NormalizedError = {
      kind: "network_error",
      message: "Request timed out after 30s",
    };
    expect(errorToMessage(err, "round")).toBe("Request timed out.");
    expect(isRetryable(err)).toBe(true);
  });

  it("quota_exhausted → correct copy, not retryable", async () => {
    const errors = await runWithError({
      kind: "quota_exhausted",
      message: "Quota exceeded",
      httpStatus: 402,
    });
    expect(errors.every((e) => e.kind === "quota_exhausted")).toBe(true);
    expect(errorToMessage(errors[0], "round")).toBe(
      "Quota exhausted. Add billing or wait for reset.",
    );
    expect(isRetryable(errors[0])).toBe(false);
  });

  it("all slots fail after retryable error exhausts 3x retry budget", async () => {
    let callCount = 0;
    mockOpenaiGenerate.mockImplementation(async () => {
      callCount++;
      return errorResult({
        kind: "server_error",
        message: "Internal error",
        httpStatus: 500,
      });
    });

    const { round } = await startRoundOne({
      prompt: "retry exhaust",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const settled = await fanOut({
      round,
      signal: new AbortController().signal,
      throttles: { openai: new ProviderThrottle(20) },
      onSlotUpdate: () => {},
    });

    expect(settled.openaiResults.every((r) => r.status === "error")).toBe(true);
    expect(callCount).toBe(12); // 4 slots × 3 attempts
  });

  it("429 count tracked per slot update for RateLimitBanner threshold", async () => {
    const updates: { kind: string }[] = [];
    mockOpenaiGenerate.mockResolvedValue(
      errorResult({
        kind: "rate_limited",
        message: "Too many requests",
        httpStatus: 429,
      }),
    );

    const { round } = await startRoundOne({
      prompt: "429 tracking",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    await fanOut({
      round,
      signal: new AbortController().signal,
      throttles: { openai: new ProviderThrottle(20) },
      onSlotUpdate: (u) => {
        if (u.result.status === "error") {
          updates.push({ kind: u.result.error.kind });
        }
      },
    });

    const rateLimited = updates.filter((u) => u.kind === "rate_limited");
    expect(rateLimited.length).toBe(4);
    expect(rateLimited.length).toBeGreaterThanOrEqual(3); // RateLimitBanner threshold
  });
});
