import { describe, expect, it, vi, afterEach } from "vitest";
import { detectPrivateBrowsing } from "./detect-private";

describe("detectPrivateBrowsing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false in normal browsing (localStorage and indexedDB work)", () => {
    expect(detectPrivateBrowsing()).toBe(false);
  });

  it("returns true when localStorage.setItem throws (Safari private)", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(detectPrivateBrowsing()).toBe(true);
  });

  it("returns true when indexedDB.open throws (Firefox private)", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {});
    vi.spyOn(window.localStorage, "removeItem").mockImplementation(() => {});
    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new DOMException("InvalidStateError");
    });
    expect(detectPrivateBrowsing()).toBe(true);
  });
});
