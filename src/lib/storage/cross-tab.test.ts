/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { listenForStorageChanges } from "./cross-tab";

describe("listenForStorageChanges", () => {
  it("calls handler when vucible:v1 key changes", () => {
    const handler = vi.fn();
    const cleanup = listenForStorageChanges(handler);

    window.dispatchEvent(
      new StorageEvent("storage", { key: "vucible:v1" }),
    );

    expect(handler).toHaveBeenCalledOnce();
    cleanup();
  });

  it("ignores other keys", () => {
    const handler = vi.fn();
    const cleanup = listenForStorageChanges(handler);

    window.dispatchEvent(
      new StorageEvent("storage", { key: "other-key" }),
    );

    expect(handler).not.toHaveBeenCalled();
    cleanup();
  });

  it("cleanup removes listener", () => {
    const handler = vi.fn();
    const cleanup = listenForStorageChanges(handler);
    cleanup();

    window.dispatchEvent(
      new StorageEvent("storage", { key: "vucible:v1" }),
    );

    expect(handler).not.toHaveBeenCalled();
  });
});
