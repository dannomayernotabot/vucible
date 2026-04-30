/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  startRoundOne,
  fanOut,
  type SlotUpdate,
} from "./orchestrate";
import { resetDbSingleton, getRound } from "@/lib/storage/history";
import { ProviderThrottle } from "./throttle";

vi.mock("@/lib/providers/openai", () => ({
  generate: vi.fn(),
  testGenerate: vi.fn(),
}));

vi.mock("@/lib/providers/gemini", () => ({
  generate: vi.fn(),
  listModels: vi.fn(),
}));

vi.mock("./thumbnails", () => ({
  generateThumbnail: vi.fn().mockResolvedValue({
    thumbnail: new ArrayBuffer(10),
    mimeType: "image/jpeg" as const,
  }),
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

import { generate as openaiGenerate } from "@/lib/providers/openai";
import { generate as geminiGenerate } from "@/lib/providers/gemini";
import * as historyModule from "@/lib/storage/history";

function makeSuccess() {
  return {
    ok: true as const,
    image: new ArrayBuffer(100),
    mimeType: "image/png",
    meta: { width: 1024, height: 1024 },
  };
}

beforeEach(async () => {
  await resetDbSingleton();
  vi.mocked(openaiGenerate).mockReset();
  vi.mocked(geminiGenerate).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fanOut integration", () => {
  it("happy path: 16 images with 8/8 split, all success", async () => {
    vi.mocked(openaiGenerate).mockResolvedValue(makeSuccess());
    vi.mocked(geminiGenerate).mockResolvedValue(makeSuccess());

    const { round } = await startRoundOne({
      prompt: "test prompt",
      modelsEnabled: { openai: true, gemini: true },
      count: 16,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    expect(round.openaiResults).toHaveLength(8);
    expect(round.geminiResults).toHaveLength(8);

    const updates: SlotUpdate[] = [];
    const settled = await fanOut({
      round,
      signal: new AbortController().signal,
      throttles: {},
      onSlotUpdate: (u) => updates.push(u),
    });

    expect(settled.openaiResults).toHaveLength(8);
    expect(settled.geminiResults).toHaveLength(8);
    expect(
      settled.openaiResults.every((r) => r.status === "success"),
    ).toBe(true);
    expect(
      settled.geminiResults.every((r) => r.status === "success"),
    ).toBe(true);
    expect(settled.settledAt).not.toBeNull();
    expect(updates).toHaveLength(16);

    const stored = await getRound(settled.id);
    expect(stored).toBeDefined();
    expect(stored!.settledAt).not.toBeNull();
  });

  it("eager intent: placeholder has loading slots with null settledAt", async () => {
    vi.mocked(openaiGenerate).mockImplementation(
      () => new Promise(() => {}),
    );

    const { round } = await startRoundOne({
      prompt: "eager intent",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const stored = await getRound(round.id);
    expect(stored).toBeDefined();
    expect(stored!.settledAt).toBeNull();
    expect(stored!.openaiResults).toHaveLength(4);
    expect(
      stored!.openaiResults.every((r) => r.status === "loading"),
    ).toBe(true);
  });

  it("mid-round abort: pending slots become error", async () => {
    vi.mocked(openaiGenerate).mockImplementation(
      (_key: string, args: { signal?: AbortSignal }) =>
        new Promise((resolve) => {
          if (args.signal?.aborted) {
            resolve({
              ok: false,
              error: { kind: "network_error", message: "Cancelled." },
            } as never);
            return;
          }
          const onAbort = () =>
            resolve({
              ok: false,
              error: { kind: "network_error", message: "Cancelled." },
            } as never);
          args.signal?.addEventListener("abort", onAbort, { once: true });
        }),
    );

    const { round } = await startRoundOne({
      prompt: "abort test",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const controller = new AbortController();
    const updates: SlotUpdate[] = [];

    const fanOutPromise = fanOut({
      round,
      signal: controller.signal,
      throttles: {},
      onSlotUpdate: (u) => updates.push(u),
    });

    controller.abort();

    const settled = await fanOutPromise;
    expect(
      settled.openaiResults.every((r) => r.status === "error"),
    ).toBe(true);
    expect(updates).toHaveLength(4);
  });

  it(
    "retryable error: withRetry attempts 3 times then fails",
    async () => {
      vi.mocked(openaiGenerate).mockResolvedValue({
        ok: false,
        error: { kind: "rate_limited", message: "Too many requests" },
      } as never);

      const { round } = await startRoundOne({
        prompt: "retry test",
        modelsEnabled: { openai: true, gemini: false },
        count: 4,
        aspect: { kind: "discrete", ratio: "1:1" },
      });

      const settled = await fanOut({
        round,
        signal: new AbortController().signal,
        throttles: {},
        onSlotUpdate: () => {},
      });

      expect(vi.mocked(openaiGenerate)).toHaveBeenCalledTimes(12);
      expect(
        settled.openaiResults.every(
          (r) =>
            r.status === "error" && r.error.kind === "rate_limited",
        ),
      ).toBe(true);
    },
    15000,
  );

  it("non-retryable error: no retry, immediate failure", async () => {
    vi.mocked(openaiGenerate).mockResolvedValue({
      ok: false,
      error: { kind: "auth_failed", message: "Invalid key" },
    } as never);

    const { round } = await startRoundOne({
      prompt: "auth error test",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const settled = await fanOut({
      round,
      signal: new AbortController().signal,
      throttles: {},
      onSlotUpdate: () => {},
    });

    expect(vi.mocked(openaiGenerate)).toHaveBeenCalledTimes(4);
    expect(
      settled.openaiResults.every(
        (r) => r.status === "error" && r.error.kind === "auth_failed",
      ),
    ).toBe(true);
  });

  it("quota exceeded on settle: round returned in memory, not re-thrown", async () => {
    vi.mocked(openaiGenerate).mockResolvedValue(makeSuccess());

    const { round } = await startRoundOne({
      prompt: "quota test",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const finalizeSpy = vi
      .spyOn(historyModule, "finalizeRound")
      .mockRejectedValueOnce(
        new DOMException("quota exceeded", "QuotaExceededError"),
      );

    const settled = await fanOut({
      round,
      signal: new AbortController().signal,
      throttles: {},
      onSlotUpdate: () => {},
    });

    expect(settled.settledAt).not.toBeNull();
    expect(
      settled.openaiResults.every((r) => r.status === "success"),
    ).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("storage full"),
    );

    warnSpy.mockRestore();
    finalizeSpy.mockRestore();
  });

  it("finalizeRound is called exactly once for the entire round", async () => {
    vi.mocked(openaiGenerate).mockResolvedValue(makeSuccess());
    vi.mocked(geminiGenerate).mockResolvedValue(makeSuccess());

    const { round } = await startRoundOne({
      prompt: "single write test",
      modelsEnabled: { openai: true, gemini: true },
      count: 8,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const finalizeSpy = vi.spyOn(historyModule, "finalizeRound");

    await fanOut({
      round,
      signal: new AbortController().signal,
      throttles: {},
      onSlotUpdate: () => {},
    });

    expect(finalizeSpy).toHaveBeenCalledTimes(1);
    finalizeSpy.mockRestore();
  });

  it("throttle with cap=1: max 1 concurrent call per provider", async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    vi.mocked(openaiGenerate).mockImplementation(async () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((r) => setTimeout(r, 5));
      currentConcurrent--;
      return makeSuccess();
    });

    const throttle = new ProviderThrottle(1);

    const { round } = await startRoundOne({
      prompt: "throttle test",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    await fanOut({
      round,
      signal: new AbortController().signal,
      throttles: { openai: throttle },
      onSlotUpdate: () => {},
    });

    expect(maxConcurrent).toBe(1);
    expect(vi.mocked(openaiGenerate)).toHaveBeenCalledTimes(4);
  });

  it(
    "recovery on 2nd attempt: retries once then succeeds",
    async () => {
      let callCount = 0;
      vi.mocked(openaiGenerate).mockImplementation(async () => {
        callCount++;
        if (callCount <= 4) {
          return {
            ok: false,
            error: { kind: "server_error", message: "500" },
          } as never;
        }
        return makeSuccess();
      });

      const { round } = await startRoundOne({
        prompt: "recovery test",
        modelsEnabled: { openai: true, gemini: false },
        count: 4,
        aspect: { kind: "discrete", ratio: "1:1" },
      });

      const settled = await fanOut({
        round,
        signal: new AbortController().signal,
        throttles: {},
        onSlotUpdate: () => {},
      });

      expect(
        settled.openaiResults.every((r) => r.status === "success"),
      ).toBe(true);
      expect(vi.mocked(openaiGenerate)).toHaveBeenCalledTimes(8);
    },
    15000,
  );
});
