import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ImageZoom } from "./ImageZoom";
import type { RoundResult } from "@/lib/storage/schema";

const mockGet = vi.fn(() => "blob:zoom-url");
const mockRelease = vi.fn();

vi.mock("@/lib/round/image-cache", () => ({
  imageCache: {
    get: (...args: unknown[]) => mockGet(...args),
    release: (...args: unknown[]) => mockRelease(...args),
  },
}));

afterEach(() => {
  cleanup();
  mockGet.mockClear();
  mockRelease.mockClear();
});

const successResult = (bytes = new ArrayBuffer(10)): RoundResult => ({
  status: "success",
  bytes,
  thumbnail: new ArrayBuffer(5),
  mimeType: "image/png",
  meta: {},
});

const errorResult: RoundResult = {
  status: "error",
  error: { kind: "unknown", message: "fail" },
};

describe("ImageZoom", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ImageZoom
        roundId="r1"
        openaiResults={[successResult()]}
        geminiResults={[]}
        initialProvider="openai"
        initialIndex={0}
        open={false}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders image when open", () => {
    render(
      <ImageZoom
        roundId="r1"
        openaiResults={[successResult()]}
        geminiResults={[]}
        initialProvider="openai"
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("img")).toBeDefined();
    expect(mockGet).toHaveBeenCalled();
  });

  it("shows prev/next buttons when multiple success slots", () => {
    render(
      <ImageZoom
        roundId="r1"
        openaiResults={[successResult(), successResult()]}
        geminiResults={[]}
        initialProvider="openai"
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Previous image")).toBeDefined();
    expect(screen.getByLabelText("Next image")).toBeDefined();
  });

  it("hides nav buttons when only one success slot", () => {
    render(
      <ImageZoom
        roundId="r1"
        openaiResults={[successResult()]}
        geminiResults={[errorResult]}
        initialProvider="openai"
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Previous image")).toBeNull();
    expect(screen.queryByLabelText("Next image")).toBeNull();
  });

  it("skips error slots when navigating", () => {
    const bytes1 = new ArrayBuffer(10);
    const bytes2 = new ArrayBuffer(20);
    render(
      <ImageZoom
        roundId="r1"
        openaiResults={[successResult(bytes1), errorResult, successResult(bytes2)]}
        geminiResults={[]}
        initialProvider="openai"
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(mockGet).toHaveBeenCalledWith("r1", "r1:openai:0", bytes1, "image/png");

    fireEvent.click(screen.getByLabelText("Next image"));
    expect(mockGet).toHaveBeenCalledWith("r1", "r1:openai:2", bytes2, "image/png");
  });

  it("navigates with arrow keys", () => {
    const bytes1 = new ArrayBuffer(10);
    const bytes2 = new ArrayBuffer(20);
    render(
      <ImageZoom
        roundId="r1"
        openaiResults={[successResult(bytes1), successResult(bytes2)]}
        geminiResults={[]}
        initialProvider="openai"
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(mockGet).toHaveBeenCalledWith("r1", "r1:openai:1", bytes2, "image/png");

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(mockGet).toHaveBeenCalledWith("r1", "r1:openai:0", bytes1, "image/png");
  });

  it("shows counter text", () => {
    render(
      <ImageZoom
        roundId="r1"
        openaiResults={[successResult(), successResult()]}
        geminiResults={[successResult()]}
        initialProvider="openai"
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("1 / 3")).toBeDefined();
  });

  it("returns nothing when no success slots exist", () => {
    const { container } = render(
      <ImageZoom
        roundId="r1"
        openaiResults={[errorResult]}
        geminiResults={[]}
        initialProvider="openai"
        initialIndex={0}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
  });
});
