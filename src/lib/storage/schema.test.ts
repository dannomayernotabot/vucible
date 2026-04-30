import { describe, expect, it } from "vitest";
import { generateId } from "./schema";

const ULID_REGEX = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

describe("generateId", () => {
  it("returns a 26-char base32 ULID", () => {
    const id = generateId();
    expect(id).toMatch(ULID_REGEX);
    expect(id.length).toBe(26);
  });

  it("produces strictly increasing IDs in a tight loop", () => {
    const ids: string[] = [];
    for (let i = 0; i < 10_000; i++) {
      ids.push(generateId());
    }
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i] > ids[i - 1]).toBe(true);
    }
  });

  it("IDs are unique", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1_000; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(1_000);
  });
});
