/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import { HistoryRail } from "./HistoryRail";
import { RoundCard } from "./RoundCard";
import { SessionsList } from "./SessionsList";
import type { Round, RoundResult, Session } from "@/lib/storage/schema";
import { thumbnailCache } from "@/lib/round/image-cache";

const { mockImageCacheGet, mockImageCacheRelease } = vi.hoisted(() => ({
  mockImageCacheGet: vi.fn(() => ""),
  mockImageCacheRelease: vi.fn(),
}));

vi.mock("@/lib/round/image-cache", () => ({
  imageCache: { get: mockImageCacheGet, release: mockImageCacheRelease },
  thumbnailCache: {
    get: vi.fn(() => "blob:thumb-url"),
    release: vi.fn(),
  },
}));

const mockListRoundsBySession = vi.fn(async () => [] as Round[]);
const mockListSessions = vi.fn(async () => [] as Session[]);

vi.mock("@/lib/storage/history", () => ({
  listRoundsBySession: (...args: unknown[]) => mockListRoundsBySession(...args),
  listSessions: (...args: unknown[]) => mockListSessions(...args),
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
  mockListSessions.mockReset();
  mockListSessions.mockResolvedValue([]);
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

  it("renders 5 rounds in chronological order", async () => {
    mockRound = makeRound();
    const rounds = Array.from({ length: 5 }, (_, i) =>
      makeRound({ id: `r${i + 1}`, number: i + 1 }),
    );
    mockListRoundsBySession.mockResolvedValue(rounds);

    await act(async () => {
      render(<HistoryRail open={true} onClose={() => {}} />);
    });

    const roundLabels = screen
      .getAllByRole("button")
      .filter((b) => /Round \d/.test(b.getAttribute("aria-label") ?? ""))
      .map((b) => b.getAttribute("aria-label"));

    expect(roundLabels).toEqual([
      "Round 1",
      "Round 2",
      "Round 3",
      "Round 4",
      "Round 5",
    ]);
  });

  it("re-fetches rounds when activeRound.settledAt changes (new round completes)", async () => {
    mockRound = makeRound();
    mockListRoundsBySession.mockResolvedValue([makeRound()]);

    const { rerender } = render(<HistoryRail open={true} onClose={() => {}} />);
    await act(async () => {});

    expect(mockListRoundsBySession).toHaveBeenCalledTimes(1);

    mockRound = makeRound({ settledAt: "2026-04-30T00:05:00Z" });
    await act(async () => {
      rerender(<HistoryRail open={true} onClose={() => {}} />);
    });

    expect(mockListRoundsBySession).toHaveBeenCalledTimes(2);
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

  it("uses thumbnailCache only — never imageCache for full bytes", () => {
    mockImageCacheGet.mockClear();
    vi.mocked(thumbnailCache.get).mockClear();

    render(
      <RoundCard round={makeRound()} isActive={false} onClick={() => {}} />,
    );

    expect(thumbnailCache.get).toHaveBeenCalled();
    expect(mockImageCacheGet).not.toHaveBeenCalled();
  });
});

function makeSession(overrides?: Partial<Session>): Session {
  return {
    id: "s1",
    startedAt: "2026-04-28T10:00:00.000Z",
    originalPrompt: "A majestic mountain landscape",
    roundIds: ["r1", "r2"],
    ...overrides,
  };
}

describe("SessionsList", () => {
  it("renders sessions with prompt and date", async () => {
    mockListSessions.mockResolvedValue([
      makeSession(),
      makeSession({ id: "s2", originalPrompt: "A serene ocean view", roundIds: ["r3"] }),
    ]);

    await act(async () => {
      render(
        <SessionsList
          activeSessionId="s1"
          onSelectSession={() => {}}
          onBack={() => {}}
        />,
      );
    });

    expect(screen.getByText("A majestic mountain landscape")).toBeDefined();
    expect(screen.getByText("A serene ocean view")).toBeDefined();
    expect(screen.getByText(/2 rounds/)).toBeDefined();
    expect(screen.getByText(/1 round$/)).toBeDefined();
  });

  it("shows empty state when no sessions", async () => {
    mockListSessions.mockResolvedValue([]);

    await act(async () => {
      render(
        <SessionsList
          activeSessionId={undefined}
          onSelectSession={() => {}}
          onBack={() => {}}
        />,
      );
    });

    expect(screen.getByText("No sessions yet")).toBeDefined();
  });

  it("calls onSelectSession on click", async () => {
    const onSelect = vi.fn();
    mockListSessions.mockResolvedValue([makeSession()]);

    await act(async () => {
      render(
        <SessionsList
          activeSessionId={undefined}
          onSelectSession={onSelect}
          onBack={() => {}}
        />,
      );
    });

    fireEvent.click(screen.getByText("A majestic mountain landscape"));
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("marks active session with aria-current", async () => {
    mockListSessions.mockResolvedValue([
      makeSession(),
      makeSession({ id: "s2", originalPrompt: "Another prompt" }),
    ]);

    await act(async () => {
      render(
        <SessionsList
          activeSessionId="s1"
          onSelectSession={() => {}}
          onBack={() => {}}
        />,
      );
    });

    const buttons = screen.getAllByRole("button").filter(b => b.getAttribute("aria-current") === "true");
    expect(buttons).toHaveLength(1);
  });

  it("calls onBack when back button clicked", async () => {
    const onBack = vi.fn();
    mockListSessions.mockResolvedValue([]);

    await act(async () => {
      render(
        <SessionsList
          activeSessionId={undefined}
          onSelectSession={() => {}}
          onBack={onBack}
        />,
      );
    });

    fireEvent.click(screen.getByLabelText("Back to rounds"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("truncates long prompts", async () => {
    const long = "A".repeat(100);
    mockListSessions.mockResolvedValue([makeSession({ originalPrompt: long })]);

    await act(async () => {
      render(
        <SessionsList
          activeSessionId={undefined}
          onSelectSession={() => {}}
          onBack={() => {}}
        />,
      );
    });

    const text = screen.getByText(/^A+…$/);
    expect(text.textContent!.length).toBe(60);
  });
});

describe("HistoryRail cross-session navigation", () => {
  it("shows Sessions button in rounds view", async () => {
    mockRound = makeRound();

    await act(async () => {
      render(<HistoryRail open={true} onClose={() => {}} />);
    });

    expect(screen.getByLabelText("View all sessions")).toBeDefined();
  });

  it("switches to sessions view on Sessions click", async () => {
    mockRound = makeRound();
    mockListSessions.mockResolvedValue([makeSession()]);

    await act(async () => {
      render(<HistoryRail open={true} onClose={() => {}} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("View all sessions"));
    });

    expect(screen.getByText("Sessions")).toBeDefined();
    expect(screen.getByText("A majestic mountain landscape")).toBeDefined();
  });

  it("selecting a session loads its rounds", async () => {
    mockRound = makeRound();
    mockListSessions.mockResolvedValue([
      makeSession({ id: "s2", originalPrompt: "Other session" }),
    ]);
    mockListRoundsBySession.mockResolvedValue([]);

    await act(async () => {
      render(<HistoryRail open={true} onClose={() => {}} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("View all sessions"));
    });

    mockListRoundsBySession.mockResolvedValue([makeRound({ id: "r5", sessionId: "s2" })]);

    await act(async () => {
      fireEvent.click(screen.getByText("Other session"));
    });

    expect(mockListRoundsBySession).toHaveBeenCalledWith("s2");
  });

  it("shows back-to-current link when viewing past session", async () => {
    mockRound = makeRound();
    mockListSessions.mockResolvedValue([
      makeSession({ id: "s2", originalPrompt: "Other session" }),
    ]);

    await act(async () => {
      render(<HistoryRail open={true} onClose={() => {}} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("View all sessions"));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Other session"));
    });

    expect(screen.getByText("← Back to current session")).toBeDefined();
  });

  it("resets view when rail closes and reopens", async () => {
    mockRound = makeRound();
    mockListSessions.mockResolvedValue([makeSession()]);

    const { rerender } = render(<HistoryRail open={true} onClose={() => {}} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("View all sessions"));
    });

    await act(async () => {
      rerender(<HistoryRail open={false} onClose={() => {}} />);
    });

    await act(async () => {
      rerender(<HistoryRail open={true} onClose={() => {}} />);
    });

    expect(screen.getByLabelText("View all sessions")).toBeDefined();
    expect(screen.queryByText("Sessions")).toBeNull();
  });
});
