/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  startRoundN,
  startRoundOne,
  fanOut,
} from "../orchestrate";
import {
  resetDbSingleton,
  getRound,
  createSession,
  putRoundPlaceholder,
  finalizeRound,
  appendRoundToSession,
} from "@/lib/storage/history";
import { generateId } from "@/lib/storage/schema";
import type { Round, RoundResult } from "@/lib/storage/schema";

vi.mock("@/lib/providers/openai", () => ({
  generate: vi.fn(),
  testGenerate: vi.fn(),
}));

vi.mock("@/lib/providers/gemini", () => ({
  generate: vi.fn(),
  listModels: vi.fn(),
}));

vi.mock("../thumbnails", () => ({
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

function makeSuccess(mimeType = "image/png"): RoundResult {
  return {
    status: "success",
    bytes: new ArrayBuffer(100),
    thumbnail: new ArrayBuffer(10),
    mimeType,
    meta: { width: 1024, height: 1024 },
  };
}

function makeSuccessGeneratorResult() {
  return {
    ok: true as const,
    image: new ArrayBuffer(100),
    mimeType: "image/png",
    meta: { width: 1024, height: 1024 },
  };
}

async function setupRound1(
  sessionId: string,
  prompt = "original prompt",
): Promise<Round> {
  const round1: Round = {
    id: generateId(),
    sessionId,
    number: 1,
    promptSent: prompt,
    modelsEnabled: { openai: true, gemini: true },
    imageCount: 4,
    aspect: { kind: "discrete", ratio: "1:1" },
    openaiResults: [makeSuccess(), makeSuccess()],
    geminiResults: [makeSuccess("image/jpeg"), makeSuccess("image/jpeg")],
    selections: [],
    commentary: null,
    startedAt: new Date().toISOString(),
    settledAt: new Date().toISOString(),
  };
  await putRoundPlaceholder(round1);
  await appendRoundToSession(sessionId, round1.id);
  await finalizeRound(round1);
  return round1;
}

beforeEach(async () => {
  await resetDbSingleton();
  vi.mocked(openaiGenerate).mockReset();
  vi.mocked(geminiGenerate).mockReset();
  vi.mocked(openaiGenerate).mockResolvedValue(makeSuccessGeneratorResult());
  vi.mocked(geminiGenerate).mockResolvedValue(makeSuccessGeneratorResult());
});

describe("startRoundN — round 2", () => {
  it("creates round with number 2 when prior round is 1", async () => {
    const session = await createSession("original prompt");
    const round1 = await setupRound1(session.id);

    const { round } = await startRoundN({
      sessionId: session.id,
      priorRoundId: round1.id,
      selections: [{ provider: "openai", index: 0 }],
      commentary: "more red",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    expect(round.number).toBe(2);
    expect(round.sessionId).toBe(session.id);
    expect(round.settledAt).toBeNull();
  });

  it("round 2 prompt contains round-1 selections and commentary", async () => {
    const session = await createSession("draw a cat");
    const round1 = await setupRound1(session.id, "draw a cat");

    const { round } = await startRoundN({
      sessionId: session.id,
      priorRoundId: round1.id,
      selections: [
        { provider: "openai", index: 0 },
        { provider: "gemini", index: 0 },
      ],
      commentary: "more red",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    expect(round.promptSent).toContain("draw a cat");
    expect(round.promptSent).toContain("After round 1");
    expect(round.promptSent).toContain("openai[0]");
    expect(round.promptSent).toContain("gemini[0]");
    expect(round.promptSent).toContain("more red");
  });

  it("persists selections to prior round in IDB", async () => {
    const session = await createSession("test");
    const round1 = await setupRound1(session.id, "test");

    const selections = [
      { provider: "openai" as const, index: 0 },
      { provider: "openai" as const, index: 1 },
      { provider: "gemini" as const, index: 0 },
      { provider: "gemini" as const, index: 1 },
    ];

    await startRoundN({
      sessionId: session.id,
      priorRoundId: round1.id,
      selections,
      commentary: "more red",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    const stored = await getRound(round1.id);
    expect(stored).toBeDefined();
    expect(stored!.selections).toHaveLength(4);
    expect(stored!.selections[0]).toEqual({ provider: "openai", index: 0 });
    expect(stored!.selections[3]).toEqual({ provider: "gemini", index: 1 });
    expect(stored!.commentary).toBe("more red");
  });

  it("returns openaiRefs with correct bytes and mimeType", async () => {
    const session = await createSession("test");
    const round1 = await setupRound1(session.id, "test");

    const { openaiRefs, geminiRefs } = await startRoundN({
      sessionId: session.id,
      priorRoundId: round1.id,
      selections: [
        { provider: "openai", index: 0 },
        { provider: "gemini", index: 0 },
      ],
      commentary: null,
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    // All selections (openai + gemini) are provided as refs to both providers
    expect(openaiRefs).toHaveLength(2);
    expect(openaiRefs[0].mimeType).toBe("image/png");
    expect(openaiRefs[0].bytes).toBeDefined();
    expect(openaiRefs[1].mimeType).toBe("image/jpeg");

    expect(geminiRefs).toHaveLength(2);
    expect(geminiRefs[0].mimeType).toBe("image/png");
    expect(typeof geminiRefs[0].base64).toBe("string");
    expect(geminiRefs[0].base64.length).toBeGreaterThan(0);
  });

  it("throws when selections is empty", async () => {
    const session = await createSession("test");
    const round1 = await setupRound1(session.id, "test");

    await expect(
      startRoundN({
        sessionId: session.id,
        priorRoundId: round1.id,
        selections: [],
        commentary: null,
        modelsEnabled: { openai: true, gemini: false },
        count: 4,
        aspect: { kind: "discrete", ratio: "1:1" },
      }),
    ).rejects.toThrow("At least one selection");
  });

  it("throws when prior round not found", async () => {
    const session = await createSession("test");

    await expect(
      startRoundN({
        sessionId: session.id,
        priorRoundId: "nonexistent-id",
        selections: [{ provider: "openai", index: 0 }],
        commentary: null,
        modelsEnabled: { openai: true, gemini: false },
        count: 4,
        aspect: { kind: "discrete", ratio: "1:1" },
      }),
    ).rejects.toThrow("not found");
  });
});

describe("startRoundN — round 3+ chain commentary", () => {
  it("round 3 prompt contains multi-round commentary trail", async () => {
    const session = await createSession("paint a sunset");

    const round1 = await setupRound1(session.id, "paint a sunset");
    const { round: round2 } = await startRoundN({
      sessionId: session.id,
      priorRoundId: round1.id,
      selections: [{ provider: "openai", index: 0 }],
      commentary: "more orange",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    await finalizeRound({
      ...round2,
      openaiResults: [makeSuccess(), makeSuccess()],
      geminiResults: [],
      settledAt: new Date().toISOString(),
    });

    const { round: round3 } = await startRoundN({
      sessionId: session.id,
      priorRoundId: round2.id,
      selections: [{ provider: "openai", index: 0 }],
      commentary: "sharper horizon",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    expect(round3.number).toBe(3);
    expect(round3.promptSent).toContain("paint a sunset");
    expect(round3.promptSent).toContain("After rounds 1-2");
    expect(round3.promptSent).toContain("sharper horizon");
  });
});

describe("startRoundN — aspect carry-forward", () => {
  it("new round uses the aspect passed to startRoundN", async () => {
    const session = await createSession("landscape");
    const round1: Round = {
      id: generateId(),
      sessionId: session.id,
      number: 1,
      promptSent: "landscape",
      modelsEnabled: { openai: true, gemini: false },
      imageCount: 4,
      aspect: { kind: "discrete", ratio: "16:9" },
      openaiResults: [makeSuccess()],
      geminiResults: [],
      selections: [],
      commentary: null,
      startedAt: new Date().toISOString(),
      settledAt: new Date().toISOString(),
    };
    await putRoundPlaceholder(round1);
    await appendRoundToSession(session.id, round1.id);
    await finalizeRound(round1);

    const { round } = await startRoundN({
      sessionId: session.id,
      priorRoundId: round1.id,
      selections: [{ provider: "openai", index: 0 }],
      commentary: null,
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "16:9" },
    });

    expect(round.aspect).toEqual({ kind: "discrete", ratio: "16:9" });
  });

  it("aspect override per round: new aspect is used, not prior", async () => {
    const session = await createSession("portrait");
    const round1: Round = {
      id: generateId(),
      sessionId: session.id,
      number: 1,
      promptSent: "portrait",
      modelsEnabled: { openai: true, gemini: false },
      imageCount: 4,
      aspect: { kind: "discrete", ratio: "16:9" },
      openaiResults: [makeSuccess()],
      geminiResults: [],
      selections: [],
      commentary: null,
      startedAt: new Date().toISOString(),
      settledAt: new Date().toISOString(),
    };
    await putRoundPlaceholder(round1);
    await appendRoundToSession(session.id, round1.id);
    await finalizeRound(round1);

    const { round } = await startRoundN({
      sessionId: session.id,
      priorRoundId: round1.id,
      selections: [{ provider: "openai", index: 0 }],
      commentary: null,
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "4:3" },
    });

    expect(round.aspect).toEqual({ kind: "discrete", ratio: "4:3" });
  });
});

describe("startRoundN — prompt overflow", () => {
  it("stays under MAX_PROMPT_CHARS with 20-round history", async () => {
    const session = await createSession("A ".repeat(100).trim());

    let priorRoundId = "";
    for (let i = 1; i <= 20; i++) {
      const round: Round = {
        id: generateId(),
        sessionId: session.id,
        number: i,
        promptSent: i === 1 ? "A ".repeat(100).trim() : "evolve prompt",
        modelsEnabled: { openai: true, gemini: false },
        imageCount: 4,
        aspect: { kind: "discrete", ratio: "1:1" },
        openaiResults: i === 20 ? [makeSuccess()] : [makeSuccess()],
        geminiResults: [],
        selections: i < 20 ? [{ provider: "openai", index: 0 }] : [],
        commentary: i < 20 ? `commentary for round ${i} with some extra text` : null,
        startedAt: new Date().toISOString(),
        settledAt: new Date().toISOString(),
      };
      await putRoundPlaceholder(round);
      await appendRoundToSession(session.id, round.id);
      await finalizeRound(round);
      priorRoundId = round.id;
    }

    const lastRound = await getRound(priorRoundId);
    expect(lastRound).toBeDefined();

    const { round } = await startRoundN({
      sessionId: session.id,
      priorRoundId,
      selections: [{ provider: "openai", index: 0 }],
      commentary: "final round",
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    expect(round.promptSent.length).toBeLessThanOrEqual(3500);
    expect(round.number).toBe(21);
  });
});

describe("startRoundN — fanOut integration (round 2)", () => {
  it("round 2 fanOut uses openaiRefs and geminiRefs from startRoundN", async () => {
    vi.mocked(openaiGenerate).mockResolvedValue(makeSuccessGeneratorResult());

    const session = await createSession("test image");
    const round1 = await setupRound1(session.id, "test image");

    const { round, openaiRefs } = await startRoundN({
      sessionId: session.id,
      priorRoundId: round1.id,
      selections: [{ provider: "openai", index: 0 }],
      commentary: null,
      modelsEnabled: { openai: true, gemini: false },
      count: 4,
      aspect: { kind: "discrete", ratio: "1:1" },
    });

    expect(openaiRefs).toHaveLength(1);

    const settled = await fanOut({
      round,
      signal: new AbortController().signal,
      throttles: {},
      onSlotUpdate: () => {},
      openaiRefs,
      geminiRefs: [],
    });

    expect(settled.settledAt).not.toBeNull();
    expect(settled.openaiResults.every((r) => r.status === "success")).toBe(true);

    const openaiCall = vi.mocked(openaiGenerate).mock.calls[0];
    const callArgs = openaiCall[1] as { referenceImages?: unknown[] };
    expect(callArgs.referenceImages).toBeDefined();
    expect(callArgs.referenceImages).toHaveLength(1);
  });
});
