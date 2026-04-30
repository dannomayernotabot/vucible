/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { startRoundOne } from "./orchestrate";
import { resetDbSingleton, getRound } from "@/lib/storage/history";

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

beforeEach(async () => {
  await resetDbSingleton();
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
