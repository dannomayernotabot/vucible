import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ImageCard } from "./ImageCard";
import { ImageCardLoading } from "./ImageCardLoading";
import { ImageCardError } from "./ImageCardError";
import { ImageCardSuccess } from "./ImageCardSuccess";
import { SelectionOverlay } from "./SelectionOverlay";
import { ModelSection } from "./ModelSection";
import type { RoundResult } from "@/lib/storage/schema";
import type { NormalizedError } from "@/lib/providers/errors";

const mockGet = vi.fn(() => "blob:test-url");
const mockRelease = vi.fn();

vi.mock("@/lib/round/image-cache", () => ({
  imageCache: {
    get: (...args: unknown[]) => mockGet(...args),
    release: (...args: unknown[]) => mockRelease(...args),
  },
}));

vi.mock("@/lib/round/failures", async () => {
  const actual = await vi.importActual<typeof import("@/lib/round/failures")>(
    "@/lib/round/failures",
  );
  return {
    ...actual,
    errorToMessage: vi.fn((err: NormalizedError) => "Error: " + err.message),
  };
});

const defaultSelectionProps = {
  selected: false,
  selectionIndex: null,
  atMax: false,
  onToggleSelection: vi.fn(),
} as const;

afterEach(() => {
  cleanup();
  mockGet.mockClear();
  mockRelease.mockClear();
});

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

  it("shows Regenerate button for retryable errors when handler provided", () => {
    const onRegenerate = vi.fn();
    const error: NormalizedError = { kind: "rate_limited", message: "Too many requests" };
    render(<ImageCardError error={error} onRegenerate={onRegenerate} />);
    const btn = screen.getByRole("button", { name: "Regenerate" });
    fireEvent.click(btn);
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it("hides Regenerate button for non-retryable errors", () => {
    const error: NormalizedError = { kind: "content_blocked", message: "Blocked" };
    render(<ImageCardError error={error} onRegenerate={() => {}} />);
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
  });

  it("hides Regenerate button when no handler provided", () => {
    const error: NormalizedError = { kind: "rate_limited", message: "Too many requests" };
    render(<ImageCardError error={error} />);
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
  });
});

describe("ImageCard", () => {
  it("renders loading state", () => {
    render(
      <ImageCard
        roundId="r1"
        slotKey="r1:openai:0"
        result={{ status: "loading" }}
        {...defaultSelectionProps}
      />,
    );
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders error state", () => {
    const result: RoundResult = {
      status: "error",
      error: { kind: "auth_failed", message: "Invalid key" },
    };
    render(
      <ImageCard
        roundId="r1"
        slotKey="r1:openai:0"
        result={result}
        {...defaultSelectionProps}
      />,
    );
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
    render(
      <ImageCard
        roundId="r1"
        slotKey="r1:openai:0"
        result={result}
        {...defaultSelectionProps}
      />,
    );
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("blob:test-url");
  });

  it("wraps success card with SelectionOverlay", () => {
    const result: RoundResult = {
      status: "success",
      bytes: new ArrayBuffer(10),
      thumbnail: new ArrayBuffer(5),
      mimeType: "image/png",
      meta: {},
    };
    render(
      <ImageCard
        roundId="r1"
        slotKey="r1:openai:0"
        result={result}
        selected={true}
        selectionIndex={0}
        atMax={false}
        onToggleSelection={vi.fn()}
      />,
    );
    expect(screen.getByRole("checkbox", { checked: true })).toBeDefined();
  });
});

describe("ModelSection", () => {
  const sectionDefaults = {
    selections: [],
    onToggleSelection: vi.fn(),
    onRegenerate: vi.fn(),
  } as const;

  it("renders section header with provider name and count", () => {
    const results: RoundResult[] = [
      { status: "loading" },
      { status: "loading" },
    ];
    render(
      <ModelSection
        roundId="r1"
        provider="openai"
        results={results}
        {...sectionDefaults}
      />,
    );
    expect(screen.getByText(/OpenAI/)).toBeDefined();
    expect(screen.getByText(/2 images/)).toBeDefined();
  });

  it("renders nothing for empty results", () => {
    const { container } = render(
      <ModelSection
        roundId="r1"
        provider="openai"
        results={[]}
        {...sectionDefaults}
      />,
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
      <ModelSection
        roundId="r1"
        provider="gemini"
        results={results}
        {...sectionDefaults}
      />,
    );
    expect(screen.getAllByRole("status")).toHaveLength(3);
  });
});

describe("ImageCardSuccess refcount lifecycle", () => {
  it("calls cache.get on mount and cache.release on unmount", () => {
    const { unmount } = render(
      <ImageCardSuccess
        roundId="r1"
        slotKey="r1:openai:0"
        bytes={new ArrayBuffer(10)}
        mimeType="image/png"
      />,
    );

    expect(mockGet).toHaveBeenCalledWith("r1", "r1:openai:0", expect.any(ArrayBuffer), "image/png");

    unmount();

    expect(mockRelease).toHaveBeenCalledWith("r1", "r1:openai:0");
  });

  it("does not leak refcounts across re-renders with same props", () => {
    const bytes = new ArrayBuffer(10);
    const { rerender, unmount } = render(
      <ImageCardSuccess
        roundId="r1"
        slotKey="r1:openai:0"
        bytes={bytes}
        mimeType="image/png"
      />,
    );

    rerender(
      <ImageCardSuccess
        roundId="r1"
        slotKey="r1:openai:0"
        bytes={bytes}
        mimeType="image/png"
      />,
    );

    expect(mockGet).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

describe("streaming card transitions", () => {
  it("transitions from loading shimmer to rendered image", () => {
    const loading: RoundResult = { status: "loading" };
    const success: RoundResult = {
      status: "success",
      bytes: new ArrayBuffer(10),
      thumbnail: new ArrayBuffer(5),
      mimeType: "image/png",
      meta: {},
    };

    const { rerender } = render(
      <ImageCard
        roundId="r1"
        slotKey="r1:openai:0"
        result={loading}
        {...defaultSelectionProps}
      />,
    );
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();

    rerender(
      <ImageCard
        roundId="r1"
        slotKey="r1:openai:0"
        result={success}
        {...defaultSelectionProps}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("img")).toBeDefined();
  });

  it("transitions from loading to error", () => {
    const loading: RoundResult = { status: "loading" };
    const error: RoundResult = {
      status: "error",
      error: { kind: "rate_limited", message: "429" },
    };

    const { rerender } = render(
      <ImageCard
        roundId="r1"
        slotKey="r1:openai:0"
        result={loading}
        {...defaultSelectionProps}
      />,
    );
    expect(screen.getByRole("status")).toBeDefined();

    rerender(
      <ImageCard
        roundId="r1"
        slotKey="r1:openai:0"
        result={error}
        {...defaultSelectionProps}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("alert")).toBeDefined();
  });
});

describe("SelectionOverlay", () => {
  it("renders checkbox role with unchecked state", () => {
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={false}
        atMax={false}
        onToggle={vi.fn()}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
  });

  it("shows selection badge when selected", () => {
    render(
      <SelectionOverlay
        selected={true}
        selectionIndex={2}
        disabled={false}
        atMax={false}
        onToggle={vi.fn()}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    expect(screen.getByRole("checkbox", { checked: true })).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("calls onToggle on click when not at max", () => {
    const toggle = vi.fn();
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={false}
        atMax={false}
        onToggle={toggle}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(toggle).toHaveBeenCalledOnce();
  });

  it("does not call onToggle when at max and not selected (5th click)", () => {
    const toggle = vi.fn();
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={false}
        atMax={true}
        onToggle={toggle}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(toggle).not.toHaveBeenCalled();
  });

  it("allows deselect when at max and already selected", () => {
    const toggle = vi.fn();
    render(
      <SelectionOverlay
        selected={true}
        selectionIndex={3}
        disabled={false}
        atMax={true}
        onToggle={toggle}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(toggle).toHaveBeenCalledOnce();
  });

  it("ignores click when disabled", () => {
    const toggle = vi.fn();
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={true}
        atMax={false}
        onToggle={toggle}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(toggle).not.toHaveBeenCalled();
  });

  it("handles keyboard Enter to toggle", () => {
    const toggle = vi.fn();
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={false}
        atMax={false}
        onToggle={toggle}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    fireEvent.keyDown(screen.getByRole("checkbox"), { key: "Enter" });
    expect(toggle).toHaveBeenCalledOnce();
  });

  it("handles keyboard Space to toggle", () => {
    const toggle = vi.fn();
    render(
      <SelectionOverlay
        selected={false}
        selectionIndex={null}
        disabled={false}
        atMax={false}
        onToggle={toggle}
      >
        <span>child</span>
      </SelectionOverlay>,
    );
    fireEvent.keyDown(screen.getByRole("checkbox"), { key: " " });
    expect(toggle).toHaveBeenCalledOnce();
  });
});
