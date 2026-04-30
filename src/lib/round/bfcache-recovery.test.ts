import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useBfcacheRecovery } from "./bfcache-recovery";
import { imageCache, thumbnailCache } from "./image-cache";

afterEach(cleanup);

function firePageShow(persisted: boolean) {
  const event = new PageTransitionEvent("pageshow", { persisted });
  window.dispatchEvent(event);
}

describe("useBfcacheRecovery", () => {
  it("clears caches on pageshow with persisted=true", () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    });

    imageCache.get("r1", "s0", new ArrayBuffer(10), "image/png");
    thumbnailCache.get("r1", "s0", new ArrayBuffer(5), "image/jpeg");
    expect(imageCache.size).toBe(1);
    expect(thumbnailCache.size).toBe(1);

    renderHook(() => useBfcacheRecovery());
    firePageShow(true);

    expect(imageCache.size).toBe(0);
    expect(thumbnailCache.size).toBe(0);
    expect(URL.revokeObjectURL).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("does not clear caches on pageshow with persisted=false", () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    });

    imageCache.get("r1", "s0", new ArrayBuffer(10), "image/png");
    expect(imageCache.size).toBe(1);

    renderHook(() => useBfcacheRecovery());
    firePageShow(false);

    expect(imageCache.size).toBe(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    imageCache.clear();
    vi.unstubAllGlobals();
  });

  it("calls onRestore callback on persisted pageshow", () => {
    const onRestore = vi.fn();
    renderHook(() => useBfcacheRecovery(onRestore));
    firePageShow(true);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("does not call onRestore for non-persisted pageshow", () => {
    const onRestore = vi.fn();
    renderHook(() => useBfcacheRecovery(onRestore));
    firePageShow(false);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it("cleans up listener on unmount", () => {
    const onRestore = vi.fn();
    const { unmount } = renderHook(() => useBfcacheRecovery(onRestore));
    unmount();
    firePageShow(true);
    expect(onRestore).not.toHaveBeenCalled();
  });
});
