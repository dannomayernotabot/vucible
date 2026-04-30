import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import { ImageCardSuccess } from "./ImageCardSuccess";
import { ModelSection } from "./ModelSection";
import type { RoundResult } from "@/lib/storage/schema";

const { mockGet, mockRelease } = vi.hoisted(() => ({
  mockGet: vi.fn(() => "blob:mock-url"),
  mockRelease: vi.fn(),
}));

vi.mock("@/lib/round/image-cache", () => ({
  imageCache: {
    get: mockGet,
    release: mockRelease,
  },
}));

afterEach(() => {
  cleanup();
  mockGet.mockClear();
  mockRelease.mockClear();
});

const SUCCESS_BYTES = new ArrayBuffer(8);
const SUCCESS_THUMB = new ArrayBuffer(4);

describe("ImageCardSuccess cache lifecycle", () => {
  it("calls imageCache.get on mount and release on unmount", () => {
    const { unmount } = render(
      <ImageCardSuccess
        roundId="r1"
        slotKey="r1:openai:0"
        bytes={SUCCESS_BYTES}
        mimeType="image/png"
      />,
    );

    expect(mockGet).toHaveBeenCalledWith("r1", "r1:openai:0", SUCCESS_BYTES, "image/png");
    expect(mockRelease).not.toHaveBeenCalled();

    unmount();

    expect(mockRelease).toHaveBeenCalledWith("r1", "r1:openai:0");
  });

  it("renders img with the url returned by imageCache.get", () => {
    render(
      <ImageCardSuccess
        roundId="r1"
        slotKey="r1:openai:0"
        bytes={SUCCESS_BYTES}
        mimeType="image/png"
      />,
    );

    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("blob:mock-url");
  });
});

describe("ModelSection streaming reconciliation", () => {
  it("stable composite slotKey renders correct card count across state transitions", async () => {
    const loadingResults: RoundResult[] = Array.from({ length: 4 }, () => ({
      status: "loading" as const,
    }));

    const { rerender } = render(
      <ModelSection roundId="r1" provider="openai" results={loadingResults} />,
    );

    expect(screen.getAllByRole("status")).toHaveLength(4);

    const partialResults: RoundResult[] = [
      {
        status: "success",
        bytes: SUCCESS_BYTES,
        thumbnail: SUCCESS_THUMB,
        mimeType: "image/png",
        meta: {},
      },
      { status: "loading" },
      { status: "loading" },
      { status: "error", error: { kind: "rate_limited", message: "rate limited" } },
    ];

    await act(async () => {
      rerender(<ModelSection roundId="r1" provider="openai" results={partialResults} />);
    });

    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("cards from different providers use isolated slotKeys", async () => {
    const openaiResults: RoundResult[] = [
      {
        status: "success",
        bytes: SUCCESS_BYTES,
        thumbnail: SUCCESS_THUMB,
        mimeType: "image/png",
        meta: {},
      },
    ];
    const geminiResults: RoundResult[] = [
      {
        status: "success",
        bytes: SUCCESS_BYTES,
        thumbnail: SUCCESS_THUMB,
        mimeType: "image/jpeg",
        meta: {},
      },
    ];

    render(
      <div>
        <ModelSection roundId="r1" provider="openai" results={openaiResults} />
        <ModelSection roundId="r1" provider="gemini" results={geminiResults} />
      </div>,
    );

    expect(mockGet).toHaveBeenCalledWith("r1", "r1:openai:0", SUCCESS_BYTES, "image/png");
    expect(mockGet).toHaveBeenCalledWith("r1", "r1:gemini:0", SUCCESS_BYTES, "image/jpeg");
  });
});
