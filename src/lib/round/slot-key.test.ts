import { describe, expect, it } from "vitest";
import { slotKey, parseSlotKey } from "./slot-key";
import type { Provider } from "@/lib/providers/types";

describe("slotKey", () => {
  it("produces the expected format", () => {
    expect(slotKey("01H7AB", "openai", 3)).toBe("01H7AB:openai:3");
  });

  it("produces distinct keys for different tuples", () => {
    const keys = new Set([
      slotKey("r1", "openai", 0),
      slotKey("r1", "openai", 1),
      slotKey("r1", "gemini", 0),
      slotKey("r2", "openai", 0),
    ]);
    expect(keys.size).toBe(4);
  });
});

describe("parseSlotKey", () => {
  it("round-trips correctly", () => {
    const providers: Provider[] = ["openai", "gemini"];
    for (const p of providers) {
      for (const i of [0, 1, 7]) {
        const key = slotKey("01H7ABCDEF", p, i);
        expect(parseSlotKey(key)).toEqual({
          roundId: "01H7ABCDEF",
          provider: p,
          index: i,
        });
      }
    }
  });

  it("returns null for wrong segment count", () => {
    expect(parseSlotKey("abc:openai")).toBeNull();
    expect(parseSlotKey("abc:openai:1:extra")).toBeNull();
    expect(parseSlotKey("")).toBeNull();
  });

  it("returns null for unknown provider", () => {
    expect(parseSlotKey("r1:dalle:0")).toBeNull();
  });

  it("returns null for non-numeric index", () => {
    expect(parseSlotKey("r1:openai:abc")).toBeNull();
  });

  it("returns null for negative index", () => {
    expect(parseSlotKey("r1:openai:-1")).toBeNull();
  });

  it("returns null for empty roundId", () => {
    expect(parseSlotKey(":openai:0")).toBeNull();
  });

  it("returns null for floating-point index", () => {
    expect(parseSlotKey("r1:openai:1.5")).toBeNull();
  });
});
