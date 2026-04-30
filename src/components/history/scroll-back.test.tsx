/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import { ScrollBackPanel } from "./ScrollBackPanel";
import type { Round } from "@/lib/storage/schema";

const mockGet = vi.fn(() => "blob:scroll-url");
const mockRelease = vi.fn();

vi.mock("@/lib/round/image-cache", () => ({
  imageCache: {
    get: (...args: unknown[]) => mockGet(...args),
    release: (...args: unknown[]) => mockRelease(...args),
  },
}));

vi.mock("@/components/round/RoundProvider", () => ({
  useRound: () => ({
    round: { id: "r1", number: 1, sessionId: "s1" },
    sessionId: "s1",
  }),
}));

vi.mock("@/lib/round/failures", async () => {
  const actual = await vi.importActual<typeof import("@/lib/round/failures")>(
    "@/lib/round/failures",
  );
  return {
    ...actual,
    errorToMessage: vi.fn(() => "Error message"),
  };
});

const mockRound: Round = {
  id: "r1",
  sessionId: "s1",
  number: 1,
  promptSent: "test prompt",
  modelsEnabled: { openai: true, gemini: false },
  imageCount: 4,
  aspect: { kind: "discrete", ratio: "1:1" },
  openaiResults: [
    {
      status: "success",
      bytes: new ArrayBuffer(10),
      thumbnail: new ArrayBuffer(5),
      mimeType: "image/png",
      meta: {},
    },
    {
      status: "error",
      error: { kind: "unknown", message: "fail" },
    },
  ],
  geminiResults: [],
  selections: [{ provider: "openai", index: 0 }],
  commentary: "more red",
  startedAt: "2026-04-30T00:00:00Z",
  settledAt: "2026-04-30T00:01:00Z",
};

vi.mock("@/lib/storage/history", () => ({
  getRound: vi.fn(() => Promise.resolve(mockRound)),
}));

let intersectionCallback: IntersectionObserverCallback | null = null;

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

afterEach(() => {
  cleanup();
  mockGet.mockClear();
  mockRelease.mockClear();
  intersectionCallback = null;
});

function triggerVisible() {
  act(() => {
    intersectionCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

function triggerHidden() {
  act(() => {
    intersectionCallback?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

describe("ScrollBackPanel", () => {
  it("shows round header with read-only label", async () => {
    await act(async () => {
      render(<ScrollBackPanel roundId="r1" onClose={vi.fn()} />);
    });
    expect(screen.getByText(/Round 1/)).toBeDefined();
    expect(screen.getByText(/read-only/)).toBeDefined();
  });

  it("shows prompt text", async () => {
    await act(async () => {
      render(<ScrollBackPanel roundId="r1" onClose={vi.fn()} />);
    });
    expect(screen.getByText(/test prompt/)).toBeDefined();
  });

  it("shows commentary when present", async () => {
    await act(async () => {
      render(<ScrollBackPanel roundId="r1" onClose={vi.fn()} />);
    });
    expect(screen.getByText(/more red/)).toBeDefined();
  });

  it("renders images only when visible (IntersectionObserver triggers)", async () => {
    await act(async () => {
      render(<ScrollBackPanel roundId="r1" onClose={vi.fn()} />);
    });

    expect(screen.queryByRole("img")).toBeNull();

    triggerVisible();

    expect(screen.getByRole("img")).toBeDefined();
  });

  it("calls onClose when back button clicked", async () => {
    const onClose = vi.fn();
    await act(async () => {
      render(<ScrollBackPanel roundId="r1" onClose={onClose} />);
    });

    fireEvent.click(screen.getByText("Back to current"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders error cards for failed slots when visible", async () => {
    await act(async () => {
      render(<ScrollBackPanel roundId="r1" onClose={vi.fn()} />);
    });

    triggerVisible();

    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("does not render Evolve button (read-only)", async () => {
    await act(async () => {
      render(<ScrollBackPanel roundId="r1" onClose={vi.fn()} />);
    });

    triggerVisible();

    expect(screen.queryByText("Evolve")).toBeNull();
  });

  it("does not render selection overlays (read-only)", async () => {
    await act(async () => {
      render(<ScrollBackPanel roundId="r1" onClose={vi.fn()} />);
    });

    triggerVisible();

    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("releases imageCache on visibility loss", async () => {
    await act(async () => {
      render(<ScrollBackPanel roundId="r1" onClose={vi.fn()} />);
    });

    triggerVisible();
    expect(mockGet).toHaveBeenCalledTimes(1);

    triggerHidden();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("releases imageCache on unmount", async () => {
    let unmount: () => void;
    await act(async () => {
      const result = render(<ScrollBackPanel roundId="r1" onClose={vi.fn()} />);
      unmount = result.unmount;
    });

    triggerVisible();
    expect(mockGet).toHaveBeenCalledTimes(1);

    unmount!();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
