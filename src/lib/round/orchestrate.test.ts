/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { startRoundOne, fanOut, type SlotUpdate } from "./orchestrate";
import { resetDbSingleton, getRound } from "@/lib/storage/history";
import { ProviderThrottle } from "./throttle";
import { PNG_1x1 } from "@/test/fixtures";
import type { NormalizedError } from "@/lib/providers/errors";

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

function successResult() {
  return {
    ok: true as const,
    image: PNG_1x1,
    mimeType: "image/png",
    meta: { width: 1, height: 1 },
  };
}

beforeEach(async () => {
  await resetDbSingleton();
  mockOpenaiGenerate.mockReset();
  mockGeminiGenerate.mockReset();
});

describe("startRoundOne", () => {
  it("creates round with loading slots for both providers", async () => {
    const result = await startRoundOne({
      prompt: "test prompt",
      modelsEnabled: { openai: true, gemini: true },
      count: 8,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    expect(result.round.openaiResults).toHaveLength(4);
    expect(result.round.geminiResults).toHaveLength(4);
    expect(result.round.openaiResults.every((r) => r.status === "loading")).toBe(true);
    expect(result.round.geminiResults.every((r) => r.status === "loading")).toBe(true);
    expect(result.round.settledAt).toBeNull();
    expect(result.sessionId).toBeTruthy();
  });

  it("creates round with single provider", async () => {
    const result = await startRoundOne({
      prompt: "openai only",
      modelsEnabled: { openai: true, gemini: false },
      count: 8,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    expect(result.round.openaiResults).toHaveLength(8);
    expect(result.round.geminiResults).toHaveLength(0);
  });

  it("persists placeholder to IndexedDB", async () => {
    const result = await startRoundOne({
      prompt: "persist test",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const stored = await getRound(result.round.id);
    expect(stored).toBeDefined();
    expect(stored!.promptSent).toBe("persist test");
    expect(stored!.settledAt).toBeNull();
  });

  it("rejects empty prompt", async () => {
    await expect(
      startRoundOne({
        prompt: "   ",
        modelsEnabled: { openai: true, gemini: false },
        count: 8,
        aspect: { kind: "discrete", ratio: "1:1" },
      }),
    ).rejects.toThrow("Prompt must not be empty.");
  });

  it("rejects no providers enabled", async () => {
    await expect(
      startRoundOne({
        prompt: "test",
        modelsEnabled: { openai: false, gemini: false },
        count: 8,
        aspect: { kind: "discrete", ratio: "1:1" },
      }),
    ).rejects.toThrow("At least one provider must be enabled.");
  });

  it("snaps freeform aspect when both providers enabled", async () => {
    const result = await startRoundOne({
      prompt: "snap test",
      modelsEnabled: { openai: true, gemini: true },
      count: 4,
      aspect: { kind: "freeform", width: 1920, height: 1080 },
    });

    expect(result.round.aspect.kind).toBe("discrete");
  });

  it("uses provided sessionId", async () => {
    const first = await startRoundOne({
      prompt: "first",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const second = await startRoundOne({
      prompt: "second",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
      sessionId: first.sessionId,
    });

    expect(second.sessionId).toBe(first.sessionId);
  });
});

describe("fanOut", () => {
  it("streams 16 cards with 8/8 split and settles all as success", async () => {
    mockOpenaiGenerate.mockResolvedValue(successResult());
    mockGeminiGenerate.mockResolvedValue(successResult());

    const { round } = await startRoundOne({
      prompt: "fan out test",
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
      throttles: {
        openai: new ProviderThrottle(20),
        gemini: new ProviderThrottle(20),
      },
      onSlotUpdate: (u) => updates.push(u),
    });

    expect(updates).toHaveLength(16);
    expect(settled.openaiResults.every((r) => r.status === "success")).toBe(true);
    expect(settled.geminiResults.every((r) => r.status === "success")).toBe(true);
    expect(settled.settledAt).not.toBeNull();
  });

  it("persists eager-intent placeholder before providers return", async () => {
    const { round } = await startRoundOne({
      prompt: "eager intent",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const stored = await getRound(round.id);
    expect(stored).toBeDefined();
    expect(stored!.settledAt).toBeNull();
    expect(stored!.openaiResults.every((r) => r.status === "loading")).toBe(true);
  });

  it("records errors for slots that fail", async () => {
    const error: NormalizedError = { kind: "server_error", message: "Internal error" };
    mockOpenaiGenerate.mockResolvedValue({ ok: false, error });

    const { round } = await startRoundOne({
      prompt: "error test",
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
    expect(settled.settledAt).not.toBeNull();
  });

  it("abort mid-round marks in-flight slots as errors", async () => {
    const controller = new AbortController();
    mockOpenaiGenerate.mockImplementation(async () => {
      controller.abort();
      throw new DOMException("The operation was aborted", "AbortError");
    });

    const { round } = await startRoundOne({
      prompt: "abort test",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const updates: SlotUpdate[] = [];
    const settled = await fanOut({
      round,
      signal: controller.signal,
      throttles: { openai: new ProviderThrottle(20) },
      onSlotUpdate: (u) => updates.push(u),
    });

    const errorSlots = settled.openaiResults.filter((r) => r.status === "error");
    expect(errorSlots.length).toBeGreaterThan(0);
    expect(settled.settledAt).not.toBeNull();
  });

  it("throttle orders slots: cap=1 means sequential", async () => {
    const callOrder: number[] = [];
    mockOpenaiGenerate.mockImplementation(async () => {
      callOrder.push(callOrder.length);
      return successResult();
    });

    const { round } = await startRoundOne({
      prompt: "throttle order",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const throttle = new ProviderThrottle(1);
    await fanOut({
      round,
      signal: new AbortController().signal,
      throttles: { openai: throttle },
      onSlotUpdate: () => {},
    });

    expect(callOrder).toEqual([0, 1, 2, 3]);
  });

  it("finalizes round in IDB after settle", async () => {
    mockOpenaiGenerate.mockResolvedValue(successResult());

    const { round } = await startRoundOne({
      prompt: "finalize test",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    await fanOut({
      round,
      signal: new AbortController().signal,
      throttles: { openai: new ProviderThrottle(20) },
      onSlotUpdate: () => {},
    });

    const stored = await getRound(round.id);
    expect(stored).toBeDefined();
    expect(stored!.settledAt).not.toBeNull();
    expect(stored!.openaiResults.every((r) => r.status === "success")).toBe(true);
  });

  it("passes openaiModel to generate calls", async () => {
    mockOpenaiGenerate.mockResolvedValue(successResult());

    const { round } = await startRoundOne({
      prompt: "model test",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
      openaiModel: "gpt-image-1.5",
    });

    await fanOut({
      round,
      signal: new AbortController().signal,
      throttles: { openai: new ProviderThrottle(20) },
      onSlotUpdate: () => {},
      openaiModel: "gpt-image-1.5",
    });

    expect(mockOpenaiGenerate).toHaveBeenCalled();
    for (const call of mockOpenaiGenerate.mock.calls) {
      expect(call[1].model).toBe("gpt-image-1.5");
    }
  });

  it("omits model (undefined) when no openaiModel specified", async () => {
    mockOpenaiGenerate.mockResolvedValue(successResult());

    const { round } = await startRoundOne({
      prompt: "default model test",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    await fanOut({
      round,
      signal: new AbortController().signal,
      throttles: { openai: new ProviderThrottle(20) },
      onSlotUpdate: () => {},
    });

    expect(mockOpenaiGenerate).toHaveBeenCalled();
    for (const call of mockOpenaiGenerate.mock.calls) {
      expect(call[1].model).toBeUndefined();
    }
  });
});
