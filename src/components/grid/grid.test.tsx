import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ImageCard } from "./ImageCard";
import { ImageCardLoading } from "./ImageCardLoading";
import { ImageCardError } from "./ImageCardError";
import { ModelSection } from "./ModelSection";
import type { RoundResult } from "@/lib/storage/schema";
import type { NormalizedError } from "@/lib/providers/errors";

vi.mock("@/lib/round/image-cache", () => ({
  imageCache: {
    get: vi.fn(() => "blob:test-url"),
    release: vi.fn(),
  },
}));

vi.mock("@/lib/round/failures", () => ({
  errorToMessage: vi.fn((err: NormalizedError) => "Error: " + err.message),
}));

afterEach(cleanup);

describe("ImageCardLoading", () => {
  it("renders shimmer placeholder with loading role", () => {
    render(<ImageCardLoading />);
    expect(screen.getByRole("status", { name: "Loading image" })).toBeDefined();
  });
});

describe("ImageCardError", () => {
  it("renders error message with alert role", () => {
    const error: NormalizedError = { kind: "rate_limited", message: "Too many requests" };
    render(<ImageCardError error={error} />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Error: Too many requests")).toBeDefined();
  });
});

describe("ImageCard", () => {
  it("renders loading state", () => {
    render(
      <ImageCard
        roundId="r1"
        slotKey="r1:openai:0"
        result={{ status: "loading" }}
      />,
    );
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders error state", () => {
    const result: RoundResult = {
      status: "error",
      error: { kind: "auth_failed", message: "Invalid key" },
    };
    render(<ImageCard roundId="r1" slotKey="r1:openai:0" result={result} />);
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("renders success state with image", () => {
    const result: RoundResult = {
      status: "success",
      bytes: new ArrayBuffer(10),
      thumbnail: new ArrayBuffer(5),
      mimeType: "image/png",
      meta: {},
    };
    render(<ImageCard roundId="r1" slotKey="r1:openai:0" result={result} />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("blob:test-url");
  });
});

describe("ModelSection", () => {
  it("renders section header with provider name and count", () => {
    const results: RoundResult[] = [
      { status: "loading" },
      { status: "loading" },
    ];
    render(
      <ModelSection roundId="r1" provider="openai" results={results} />,
    );
    expect(screen.getByText(/OpenAI/)).toBeDefined();
    expect(screen.getByText(/2 images/)).toBeDefined();
  });

  it("renders nothing for empty results", () => {
    const { container } = render(
      <ModelSection roundId="r1" provider="openai" results={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders correct number of cards", () => {
    const results: RoundResult[] = [
      { status: "loading" },
      { status: "loading" },
      { status: "loading" },
    ];
    render(
      <ModelSection roundId="r1" provider="gemini" results={results} />,
    );
    expect(screen.getAllByRole("status")).toHaveLength(3);
  });
});
