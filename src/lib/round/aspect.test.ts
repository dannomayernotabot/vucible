import { describe, expect, it } from "vitest";
import { findNearestRatio, snapAspectIfNeeded } from "./aspect";
import type { AspectRatioConfig, ProviderConfig } from "@/lib/providers/types";

const geminiConfig: ProviderConfig = {
  apiKey: "test-key",
  tier: "tier1",
  ipm: 10,
  concurrencyCap: 5,
  validatedAt: "2026-04-28T00:00:00Z",
};

describe("findNearestRatio", () => {
  const cases: [number, number, string][] = [
    [100, 100, "1:1"],
    [1024, 1024, "1:1"],
    [300, 200, "3:2"],
    [200, 300, "2:3"],
    [300, 400, "3:4"],
    [400, 300, "4:3"],
    [400, 500, "4:5"],
    [500, 400, "5:4"],
    [900, 1600, "9:16"],
    [1600, 900, "16:9"],
    [2100, 900, "21:9"],
    [1280, 512, "21:9"],
    [1, 1, "1:1"],
    [10000, 1, "8:1"],
    [1, 10000, "1:8"],
    [1920, 1080, "16:9"],
    [1080, 1920, "9:16"],
    [800, 600, "4:3"],
    [600, 800, "3:4"],
    [640, 480, "4:3"],
    [400, 100, "4:1"],
    [800, 100, "8:1"],
    [100, 400, "1:4"],
    [100, 800, "1:8"],
  ];

  it.each(cases)("(%d, %d) → %s", (w, h, expected) => {
    expect(findNearestRatio(w, h)).toBe(expected);
  });
});

describe("snapAspectIfNeeded", () => {
  it("returns freeform unchanged when no Gemini provider", () => {
    const aspect: AspectRatioConfig = { kind: "freeform", width: 1280, height: 512 };
    const result = snapAspectIfNeeded(aspect, {});
    expect(result).toEqual(aspect);
  });

  it("returns freeform unchanged when only OpenAI present", () => {
    const aspect: AspectRatioConfig = { kind: "freeform", width: 100, height: 100 };
    const result = snapAspectIfNeeded(aspect, { openai: geminiConfig });
    expect(result).toEqual(aspect);
  });

  it("returns discrete unchanged when Gemini present", () => {
    const aspect: AspectRatioConfig = { kind: "discrete", ratio: "16:9" };
    const result = snapAspectIfNeeded(aspect, { gemini: geminiConfig });
    expect(result).toEqual({ kind: "discrete", ratio: "16:9" });
  });

  it("snaps freeform 1280x512 to 21:9 when Gemini present", () => {
    const aspect: AspectRatioConfig = { kind: "freeform", width: 1280, height: 512 };
    const result = snapAspectIfNeeded(aspect, { gemini: geminiConfig });
    expect(result).toEqual({ kind: "discrete", ratio: "21:9" });
  });

  it("snaps freeform 100x100 to 1:1 when Gemini present", () => {
    const aspect: AspectRatioConfig = { kind: "freeform", width: 100, height: 100 };
    const result = snapAspectIfNeeded(aspect, { gemini: geminiConfig });
    expect(result).toEqual({ kind: "discrete", ratio: "1:1" });
  });

  it("snaps freeform 1920x1080 to 16:9 when Gemini present", () => {
    const aspect: AspectRatioConfig = { kind: "freeform", width: 1920, height: 1080 };
    const result = snapAspectIfNeeded(aspect, { gemini: geminiConfig });
    expect(result).toEqual({ kind: "discrete", ratio: "16:9" });
  });

  it("snaps freeform portrait to nearest portrait ratio", () => {
    const aspect: AspectRatioConfig = { kind: "freeform", width: 1080, height: 1920 };
    const result = snapAspectIfNeeded(aspect, { gemini: geminiConfig });
    expect(result).toEqual({ kind: "discrete", ratio: "9:16" });
  });

  it("snaps extreme landscape 100:1 to 8:1", () => {
    const aspect: AspectRatioConfig = { kind: "freeform", width: 10000, height: 100 };
    const result = snapAspectIfNeeded(aspect, { gemini: geminiConfig });
    expect(result).toEqual({ kind: "discrete", ratio: "8:1" });
  });

  it("snaps vertical 1:3 to nearest portrait ratio", () => {
    const aspect: AspectRatioConfig = { kind: "freeform", width: 100, height: 300 };
    const result = snapAspectIfNeeded(aspect, { gemini: geminiConfig });
    expect(result).toEqual({ kind: "discrete", ratio: "1:4" });
  });

  it("snaps freeform 5:2 to 21:9 when Gemini present", () => {
    const aspect: AspectRatioConfig = { kind: "freeform", width: 500, height: 200 };
    const result = snapAspectIfNeeded(aspect, { gemini: geminiConfig });
    expect(result).toEqual({ kind: "discrete", ratio: "21:9" });
  });

  const ALL_DISCRETE_RATIOS = [
    "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3",
    "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
  ] as const;

  it.each(ALL_DISCRETE_RATIOS)(
    "discrete %s passes through unchanged (idempotent)",
    (ratio) => {
      const aspect: AspectRatioConfig = { kind: "discrete", ratio };
      const result = snapAspectIfNeeded(aspect, { gemini: geminiConfig });
      expect(result).toEqual({ kind: "discrete", ratio });
    },
  );

  const FREEFORM_SNAP_CASES: [number, number, string][] = [
    [100, 100, "1:1"],
    [100, 400, "1:4"],
    [100, 800, "1:8"],
    [200, 300, "2:3"],
    [300, 200, "3:2"],
    [300, 400, "3:4"],
    [400, 100, "4:1"],
    [400, 300, "4:3"],
    [400, 500, "4:5"],
    [500, 400, "5:4"],
    [800, 100, "8:1"],
    [900, 1600, "9:16"],
    [1600, 900, "16:9"],
    [2100, 900, "21:9"],
  ];

  it.each(FREEFORM_SNAP_CASES)(
    "freeform %dx%d snaps to %s with Gemini",
    (w, h, expected) => {
      const aspect: AspectRatioConfig = { kind: "freeform", width: w, height: h };
      const result = snapAspectIfNeeded(aspect, { gemini: geminiConfig });
      expect(result).toEqual({ kind: "discrete", ratio: expected });
    },
  );
});
