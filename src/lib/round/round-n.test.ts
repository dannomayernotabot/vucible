/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { startRoundOne, startRoundN, fanOut, type SlotUpdate } from "./orchestrate";
import { resetDbSingleton, getRound, listRoundsBySession } from "@/lib/storage/history";
import { ProviderThrottle } from "./throttle";
import { PNG_1x1 } from "@/test/fixtures";

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

const throttles = () => ({
  openai: new ProviderThrottle(20),
  gemini: new ProviderThrottle(20),
});

async function settleRound(sessionId: string, roundInput: Awaited<ReturnType<typeof startRoundOne>>) {
  return fanOut({
    round: roundInput.round,
    signal: new AbortController().signal,
    throttles: throttles(),
    onSlotUpdate: () => {},
  });
}

beforeEach(async () => {
  await resetDbSingleton();
  mockOpenaiGenerate.mockReset();
  mockGeminiGenerate.mockReset();
  mockOpenaiGenerate.mockResolvedValue(successResult());
  mockGeminiGenerate.mockResolvedValue(successResult());
});

describe("startRoundN", () => {
  it("creates round 2 with correct prompt template", async () => {
    const r1 = await startRoundOne({
      prompt: "draw a cat",
      modelsEnabled: { openai: true, gemini: true },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });
    const settled1 = await settleRound(r1.sessionId, r1);

    const r2 = await startRoundN({
      sessionId: r1.sessionId,
      priorRoundId: settled1.id,
      selections: [
        { provider: "openai", index: 0 },
        { provider: "gemini", index: 1 },
      ],
      commentary: "more contrast",
      modelsEnabled: { openai: true, gemini: true },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    expect(r2.round.number).toBe(2);
    expect(r2.round.promptSent).toContain("draw a cat");
    expect(r2.round.promptSent).toContain("After round 1 the user picked");
    expect(r2.round.promptSent).toContain("openai[0]");
    expect(r2.round.promptSent).toContain("gemini[1]");
    expect(r2.round.promptSent).toContain('"more contrast"');
    expect(r2.round.promptSent).toContain("Generate fresh variations");
  });

  it("persists selections on prior round after evolve", async () => {
    const r1 = await startRoundOne({
      prompt: "persist selections",
      modelsEnabled: { openai: true, gemini: true },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });
    const settled1 = await settleRound(r1.sessionId, r1);

    const selections = [
      { provider: "openai" as const, index: 0 },
      { provider: "openai" as const, index: 1 },
      { provider: "gemini" as const, index: 0 },
      { provider: "gemini" as const, index: 1 },
    ];

    await startRoundN({
      sessionId: r1.sessionId,
      priorRoundId: settled1.id,
      selections,
      commentary: "nice",
      modelsEnabled: { openai: true, gemini: true },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const stored = await getRound(settled1.id);
    expect(stored!.selections).toHaveLength(4);
    expect(stored!.selections[0]).toEqual({ provider: "openai", index: 0 });
    expect(stored!.selections[3]).toEqual({ provider: "gemini", index: 1 });
    expect(stored!.commentary).toBe("nice");
  });

  it("chains 3 rounds with accumulated commentary trail", async () => {
    const r1 = await startRoundOne({
      prompt: "original prompt",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });
    const settled1 = await settleRound(r1.sessionId, r1);

    const r2Result = await startRoundN({
      sessionId: r1.sessionId,
      priorRoundId: settled1.id,
      selections: [{ provider: "openai", index: 0 }],
      commentary: "more red",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });
    const settled2 = await fanOut({
      round: r2Result.round,
      signal: new AbortController().signal,
      throttles: throttles(),
      onSlotUpdate: () => {},
    });

    const r3Result = await startRoundN({
      sessionId: r1.sessionId,
      priorRoundId: settled2.id,
      selections: [{ provider: "openai", index: 1 }],
      commentary: "sharper edges",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    expect(r3Result.round.number).toBe(3);
    expect(r3Result.round.promptSent).toContain("original prompt");
    expect(r3Result.round.promptSent).toContain("After rounds 1-2");
    expect(r3Result.round.promptSent).toContain('"more red"');
    expect(r3Result.round.promptSent).toContain('"sharper edges"');
  });

  it("appends round IDs to session in IDB", async () => {
    const r1 = await startRoundOne({
      prompt: "session tracking",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });
    const settled1 = await settleRound(r1.sessionId, r1);

    const r2Result = await startRoundN({
      sessionId: r1.sessionId,
      priorRoundId: settled1.id,
      selections: [{ provider: "openai", index: 0 }],
      commentary: null,
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const rounds = await listRoundsBySession(r1.sessionId);
    expect(rounds).toHaveLength(2);
    expect(rounds[0].id).toBe(settled1.id);
    expect(rounds[1].id).toBe(r2Result.round.id);
  });

  it("preserves aspect ratio across rounds", async () => {
    const r1 = await startRoundOne({
      prompt: "aspect test",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "16:9" },
    });
    const settled1 = await settleRound(r1.sessionId, r1);

    const r2Result = await startRoundN({
      sessionId: r1.sessionId,
      priorRoundId: settled1.id,
      selections: [{ provider: "openai", index: 0 }],
      commentary: null,
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "16:9" },
    });

    expect(r2Result.round.aspect).toEqual({ kind: "discrete", ratio: "16:9" });
  });

  it("prepares correct reference formats for both providers", async () => {
    const r1 = await startRoundOne({
      prompt: "ref formats",
      modelsEnabled: { openai: true, gemini: true },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });
    const settled1 = await settleRound(r1.sessionId, r1);

    const r2Result = await startRoundN({
      sessionId: r1.sessionId,
      priorRoundId: settled1.id,
      selections: [
        { provider: "openai", index: 0 },
        { provider: "gemini", index: 0 },
      ],
      commentary: null,
      modelsEnabled: { openai: true, gemini: true },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    expect(r2Result.openaiRefs).toHaveLength(2);
    expect(r2Result.geminiRefs).toHaveLength(2);
    expect(r2Result.openaiRefs[0].mimeType).toBe("image/png");
    expect(r2Result.geminiRefs[0].base64.length).toBeGreaterThan(0);
  });

  it("rejects with no selections", async () => {
    const r1 = await startRoundOne({
      prompt: "no selections",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });
    await settleRound(r1.sessionId, r1);

    await expect(
      startRoundN({
        sessionId: r1.sessionId,
        priorRoundId: r1.round.id,
        selections: [],
        commentary: null,
        modelsEnabled: { openai: true, gemini: false },
        count: 4,
        aspect: { kind: "discrete", ratio: "1:1" },
      }),
    ).rejects.toThrow("At least one selection");
  });

  it("round 2 with null commentary includes 'No additional commentary'", async () => {
    const r1 = await startRoundOne({
      prompt: "no commentary test",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });
    const settled1 = await settleRound(r1.sessionId, r1);

    const r2 = await startRoundN({
      sessionId: r1.sessionId,
      priorRoundId: settled1.id,
      selections: [{ provider: "openai", index: 0 }],
      commentary: null,
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    expect(r2.round.promptSent).toContain("No additional commentary");
  });

  it("round 2 fanOut passes references to providers", async () => {
    const r1 = await startRoundOne({
      prompt: "ref pass-through",
      modelsEnabled: { openai: true, gemini: true },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });
    const settled1 = await settleRound(r1.sessionId, r1);

    const r2 = await startRoundN({
      sessionId: r1.sessionId,
      priorRoundId: settled1.id,
      selections: [{ provider: "openai", index: 0 }],
      commentary: null,
      modelsEnabled: { openai: true, gemini: true },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    mockOpenaiGenerate.mockClear();
    mockGeminiGenerate.mockClear();

    await fanOut({
      round: r2.round,
      signal: new AbortController().signal,
      throttles: throttles(),
      onSlotUpdate: () => {},
      openaiRefs: r2.openaiRefs,
      geminiRefs: r2.geminiRefs,
    });

    expect(mockOpenaiGenerate).toHaveBeenCalled();
    const openaiCall = mockOpenaiGenerate.mock.calls[0];
    expect(openaiCall[1].referenceImages).toHaveLength(1);

    expect(mockGeminiGenerate).toHaveBeenCalled();
    const geminiCall = mockGeminiGenerate.mock.calls[0];
    expect(geminiCall[1].referenceImages).toHaveLength(1);
  });
});
