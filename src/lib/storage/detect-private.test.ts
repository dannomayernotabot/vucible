import { describe, expect, it, vi, afterEach } from "vitest";
import { isPrivateBrowsing } from "./detect-private";

describe("isPrivateBrowsing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false in normal browsing (localStorage + IDB work)", async () => {
    expect(await isPrivateBrowsing()).toBe(false);
  });

  it("returns true when localStorage.setItem throws QuotaExceededError", async () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    expect(await isPrivateBrowsing()).toBe(true);
  });

  it("returns true when indexedDB.open throws", async () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {});
    vi.spyOn(window.localStorage, "removeItem").mockImplementation(() => {});

    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new DOMException("InvalidStateError", "InvalidStateError");
    });

    expect(await isPrivateBrowsing()).toBe(true);
  });

  it("cleans up probe key from localStorage after test", async () => {
    await isPrivateBrowsing();
    expect(window.localStorage.getItem("__vucible_private_probe__")).toBeNull();
  });
});
