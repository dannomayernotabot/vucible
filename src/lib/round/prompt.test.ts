import { describe, expect, it } from "vitest";
import { buildEvolvePrompt, MAX_PROMPT_CHARS } from "./prompt";
import type { Round } from "@/lib/storage/schema";

function makeRound(n: number, commentary: string | null = null): Round {
  return {
    id: `round-${n}`,
    sessionId: "session-1",
    number: n,
    promptSent: "test prompt",
    modelsEnabled: { openai: true, gemini: true },
    imageCount: 4,
    aspect: { kind: "discrete", ratio: "1:1" },
    openaiResults: [],
    geminiResults: [],
    selections: [{ provider: "openai", index: 0 }],
    commentary,
    startedAt: new Date().toISOString(),
    settledAt: new Date().toISOString(),
  };
}

describe("buildEvolvePrompt", () => {
  it("returns original prompt for round 1 (no prior rounds)", () => {
    const result = buildEvolvePrompt("draw a cat", [], [], null);
    expect(result).toBe("draw a cat");
  });

  it("builds round 2 template with selections and commentary", () => {
    const round1 = makeRound(1, "make it redder");
    const result = buildEvolvePrompt(
      "draw a cat",
      [round1],
      [{ provider: "openai", index: 0 }, { provider: "gemini", index: 2 }],
      "more contrast",
    );
    expect(result).toContain("draw a cat");
    expect(result).toContain("After round 1 the user picked");
    expect(result).toContain("openai[0]");
    expect(result).toContain("gemini[2]");
    expect(result).toContain('Their commentary: "more contrast"');
    expect(result).toContain("Generate fresh variations");
  });

  it("handles round 2 with no commentary", () => {
    const round1 = makeRound(1);
    const result = buildEvolvePrompt(
      "draw a cat",
      [round1],
      [{ provider: "openai", index: 0 }],
      null,
    );
    expect(result).toContain("No additional commentary");
  });

  it("builds round N template with accumulated trail", () => {
    const rounds = [
      makeRound(1, "more red"),
      makeRound(2, "sharper edges"),
      makeRound(3, "add sparkles"),
    ];
    const result = buildEvolvePrompt(
      "draw a cat",
      rounds,
      [{ provider: "gemini", index: 1 }],
      "final touch",
    );
    expect(result).toContain("After rounds 1-3");
    expect(result).toContain('"more red"');
    expect(result).toContain('"sharper edges"');
    expect(result).toContain('"add sparkles"');
    expect(result).toContain('"final touch"');
  });

  it("handles no selections gracefully", () => {
    const round1 = makeRound(1);
    const result = buildEvolvePrompt("draw a cat", [round1], [], "hi");
    expect(result).toContain("no references");
  });

  it("stays under MAX_PROMPT_CHARS with 20-round history", () => {
    const rounds = Array.from({ length: 20 }, (_, i) =>
      makeRound(
        i + 1,
        `Round ${i + 1} commentary with some extra detail to make it longer and more realistic`,
      ),
    );
    const result = buildEvolvePrompt(
      "A detailed prompt about generating a photorealistic landscape",
      rounds,
      [{ provider: "openai", index: 0 }],
      "final adjustments here",
    );
    expect(result.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
  });

  it("keeps recent 3 rounds verbatim when collapsing", () => {
    const rounds = Array.from({ length: 10 }, (_, i) =>
      makeRound(i + 1, `commentary-${i + 1}`),
    );
    const result = buildEvolvePrompt(
      "draw a cat",
      rounds,
      [{ provider: "openai", index: 0 }],
      "latest",
    );
    expect(result).toContain('"commentary-8"');
    expect(result).toContain('"commentary-9"');
    expect(result).toContain('"commentary-10"');
  });

  it("collapses old rounds with first 50 chars", () => {
    const longCommentary = "A".repeat(100);
    const rounds = Array.from({ length: 10 }, (_, i) =>
      makeRound(i + 1, i < 5 ? longCommentary : `short-${i + 1}`),
    );

    const prompt = "x".repeat(3000);
    const result = buildEvolvePrompt(
      prompt,
      rounds,
      [{ provider: "openai", index: 0 }],
      "done",
    );
    expect(result.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    expect(result).toContain("commentary trail summarized");
  });

  it.each([2, 3, 5, 10, 15, 20])("round %d produces valid output", (n) => {
    const rounds = Array.from({ length: n - 1 }, (_, i) =>
      makeRound(i + 1, `round ${i + 1} notes`),
    );
    const result = buildEvolvePrompt(
      "create an image",
      rounds,
      [{ provider: "openai", index: 0 }],
      "current notes",
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    expect(result).toContain("create an image");
  });
});
