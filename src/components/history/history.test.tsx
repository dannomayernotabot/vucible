/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import { HistoryRail } from "./HistoryRail";
import { RoundCard } from "./RoundCard";
import type { Round, RoundResult } from "@/lib/storage/schema";
import { thumbnailCache } from "@/lib/round/image-cache";

vi.mock("@/lib/round/image-cache", () => ({
  imageCache: { get: vi.fn(() => ""), release: vi.fn() },
  thumbnailCache: {
    get: vi.fn(() => "blob:thumb-url"),
    release: vi.fn(),
  },
}));

const mockListRoundsBySession = vi.fn(async () => [] as Round[]);

vi.mock("@/lib/storage/history", () => ({
  listRoundsBySession: (...args: unknown[]) => mockListRoundsBySession(...args),
}));

let mockRound: Round | null = null;

vi.mock("@/components/round/RoundProvider", () => ({
  useRound: () => ({
    round: mockRound,
    isRunning: false,
    done: 0,
    total: 0,
    queued: 0,
    consecutive429Count: { openai: 0, gemini: 0 },
    startRound: vi.fn(),
    abortRound: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  mockListRoundsBySession.mockReset();
  mockListRoundsBySession.mockResolvedValue([]);
  mockRound = null;
});

function makeRound(overrides?: Partial<Round>): Round {
  const success: RoundResult = {
    status: "success",
    bytes: new ArrayBuffer(10),
    thumbnail: new ArrayBuffer(5),
    mimeType: "image/png",
    meta: {},
  };
  const error: RoundResult = {
    status: "error",
    error: { kind: "server_error", message: "fail" },
  };
  return {
    id: "r1",
    sessionId: "s1",
    number: 1,
    promptSent: "test prompt",
    modelsEnabled: { openai: true, gemini: false },
    imageCount: 4,
    aspect: { kind: "discrete", ratio: "1:1" },
    openaiResults: [success, success, error, success],
    geminiResults: [],
    selections: [],
    commentary: null,
    startedAt: new Date().toISOString(),
    settledAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("HistoryRail", () => {
  it("renders nothing when closed", () => {
    mockRound = makeRound();
    const { container } = render(<HistoryRail open={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders aside when open", async () => {
    mockRound = makeRound();
    await act(async () => {
      render(<HistoryRail open={true} onClose={() => {}} />);
    });
    expect(screen.getByLabelText("Round history")).toBeDefined();
  });

  it("loads rounds from IDB when opened with active session", async () => {
    mockRound = makeRound();
    mockListRoundsBySession.mockResolvedValue([makeRound(), makeRound({ id: "r2", number: 2 })]);

    await act(async () => {
      render(<HistoryRail open={true} onClose={() => {}} />);
    });

    expect(mockListRoundsBySession).toHaveBeenCalledWith("s1");
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(2);
  });

  it("shows empty state when no rounds", async () => {
    mockRound = makeRound();
    mockListRoundsBySession.mockResolvedValue([]);

    await act(async () => {
      render(<HistoryRail open={true} onClose={() => {}} />);
    });

    expect(screen.getByText("No rounds yet")).toBeDefined();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    mockRound = makeRound();

    await act(async () => {
      render(<HistoryRail open={true} onClose={onClose} />);
    });

    fireEvent.click(screen.getByLabelText("Close history"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("RoundCard", () => {
  it("renders round number and image counts", () => {
    render(
      <RoundCard round={makeRound()} isActive={false} onClick={() => {}} />,
    );
    expect(screen.getByText(/Round 1/)).toBeDefined();
    expect(screen.getByText(/3 images/)).toBeDefined();
    expect(screen.getByText(/1 failed/)).toBeDefined();
  });

  it("renders thumbnail images for success slots", () => {
    const { container } = render(
      <RoundCard round={makeRound()} isActive={false} onClick={() => {}} />,
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(3);
    expect(imgs[0].getAttribute("src")).toBe("blob:thumb-url");
  });

  it("marks active round with aria-current", () => {
    render(
      <RoundCard round={makeRound()} isActive={true} onClick={() => {}} />,
    );
    const btn = screen.getByRole("button", { name: "Round 1" });
    expect(btn.getAttribute("aria-current")).toBe("true");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <RoundCard round={makeRound()} isActive={false} onClick={onClick} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Round 1" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("releases thumbnailCache entries on unmount", () => {
    vi.mocked(thumbnailCache.release).mockClear();

    const round = makeRound();
    const { unmount } = render(
      <RoundCard round={round} isActive={false} onClick={() => {}} />,
    );

    unmount();

    expect(thumbnailCache.release).toHaveBeenCalledTimes(3);
  });

  it("does not release non-success slots on unmount", () => {
    vi.mocked(thumbnailCache.release).mockClear();

    const allErrors: RoundResult = {
      status: "error",
      error: { kind: "server_error", message: "fail" },
    };
    const round = makeRound({
      openaiResults: [allErrors, allErrors, allErrors, allErrors],
    });
    const { unmount } = render(
      <RoundCard round={round} isActive={false} onClick={() => {}} />,
    );

    unmount();

    expect(thumbnailCache.release).not.toHaveBeenCalled();
  });

  it("shows up to 8 thumbnails max", () => {
    const success: RoundResult = {
      status: "success",
      bytes: new ArrayBuffer(10),
      thumbnail: new ArrayBuffer(5),
      mimeType: "image/png",
      meta: {},
    };
    const round = makeRound({
      imageCount: 16,
      openaiResults: Array.from({ length: 16 }, () => success),
    });
    const { container } = render(
      <RoundCard round={round} isActive={false} onClick={() => {}} />,
    );
    const gridItems = container.querySelectorAll(".aspect-square");
    expect(gridItems.length).toBe(8);
  });
});
