import { describe, expect, it } from "vitest";
import { ipmToTier, defaultIpm } from "./tiers";

describe("ipmToTier", () => {
  const exactCases: [number, string][] = [
    [0, "free"],
    [5, "tier1"],
    [20, "tier2"],
    [50, "tier3"],
    [100, "tier4"],
    [250, "tier5"],
  ];

  it.each(exactCases)("ipmToTier(%d) === %s (exact match)", (ipm, expected) => {
    expect(ipmToTier(ipm)).toBe(expected);
  });

  const interpolatedCases: [number, string][] = [
    [1, "free"],
    [3, "tier1"],
    [10, "tier1"],
    [12, "tier1"],
    [13, "tier2"],
    [15, "tier2"],
    [30, "tier2"],
    [35, "tier2"],
    [75, "tier3"],
    [76, "tier4"],
    [150, "tier4"],
    [200, "tier5"],
    [500, "tier5"],
    [1000, "tier5"],
  ];

  it.each(interpolatedCases)(
    "ipmToTier(%d) === %s (closest match)",
    (ipm, expected) => {
      expect(ipmToTier(ipm)).toBe(expected);
    },
  );
});

describe("defaultIpm", () => {
  const cases: [string, number][] = [
    ["free", 0],
    ["tier1", 5],
    ["tier2", 20],
    ["tier3", 50],
    ["tier4", 100],
    ["tier5", 250],
  ];

  it.each(cases)("defaultIpm(%s) === %d", (tier, expected) => {
    expect(defaultIpm(tier as Parameters<typeof defaultIpm>[0])).toBe(expected);
  });
});
