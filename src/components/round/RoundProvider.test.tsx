import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import { RoundProvider, useRound } from "./RoundProvider";
import type { SlotUpdate } from "@/lib/round/orchestrate";
import type { Round, RoundResult } from "@/lib/storage/schema";

const mockStartRoundOne = vi.fn();
const mockFanOut = vi.fn();

vi.mock("@/lib/round/orchestrate", () => ({
  startRoundOne: (...args: unknown[]) => mockStartRoundOne(...args),
  fanOut: (...args: unknown[]) => mockFanOut(...args),
}));

vi.mock("@/lib/round/throttle", () => {
  class MockThrottle {
    private handlers: (() => void)[] = [];
    setCap() {}
    queued() {
      return 0;
    }
    addEventListener(_: string, fn: () => void) {
      this.handlers.push(fn);
    }
    removeEventListener(_: string, fn: () => void) {
      this.handlers = this.handlers.filter((h) => h !== fn);
    }
  }
  return { ProviderThrottle: MockThrottle };
});

afterEach(() => {
  cleanup();
  mockStartRoundOne.mockReset();
  mockFanOut.mockReset();
});

function Consumer() {
  const ctx = useRound();
  return (
    <div>
      <span data-testid="isRunning">{String(ctx.isRunning)}</span>
      <span data-testid="done">{ctx.done}</span>
      <span data-testid="total">{ctx.total}</span>
      <span data-testid="queued">{ctx.queued}</span>
      <span data-testid="c429-openai">{ctx.consecutive429Count.openai}</span>
      <span data-testid="c429-gemini">{ctx.consecutive429Count.gemini}</span>
      <span data-testid="round">{ctx.round ? "yes" : "no"}</span>
      <span data-testid="selections">{ctx.selections.length}</span>
    </div>
  );
}

function makeLoadingRound(openaiCount: number, geminiCount: number): Round {
  const loading: RoundResult = { status: "loading" };
  return {
    id: "test-round",
    sessionId: "test-session",
    number: 1,
    promptSent: "test",
    modelsEnabled: { openai: openaiCount > 0, gemini: geminiCount > 0 },
    imageCount: (openaiCount + geminiCount) as 4 | 8 | 16,
    aspect: { kind: "discrete", ratio: "1:1" },
    openaiResults: Array.from({ length: openaiCount }, () => loading),
    geminiResults: Array.from({ length: geminiCount }, () => loading),
    selections: [],
    commentary: null,
    startedAt: new Date().toISOString(),
    settledAt: null,
  };
}

describe("RoundProvider", () => {
  it("provides initial state with no round", () => {
    render(
      <RoundProvider>
        <Consumer />
      </RoundProvider>,
    );
    expect(screen.getByTestId("round").textContent).toBe("no");
    expect(screen.getByTestId("isRunning").textContent).toBe("false");
    expect(screen.getByTestId("done").textContent).toBe("0");
    expect(screen.getByTestId("total").textContent).toBe("0");
    expect(screen.getByTestId("queued").textContent).toBe("0");
    expect(screen.getByTestId("c429-openai").textContent).toBe("0");
    expect(screen.getByTestId("c429-gemini").textContent).toBe("0");
  });

  it("throws when useRound is used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      "useRound must be used within RoundProvider",
    );
    spy.mockRestore();
  });
});

describe("RoundProvider 429 tracking", () => {
  it("increments consecutive429Count on rate_limited settle", async () => {
    const round = makeLoadingRound(2, 0);
    let capturedOnSlotUpdate: ((u: SlotUpdate) => void) | null = null;

    mockStartRoundOne.mockResolvedValue({ round, sessionId: "s1" });
    mockFanOut.mockImplementation(async (opts: { onSlotUpdate: (u: SlotUpdate) => void }) => {
      capturedOnSlotUpdate = opts.onSlotUpdate;
      return { ...round, settledAt: new Date().toISOString() };
    });

    let triggerStart: (() => void) | null = null;
    function StartConsumer() {
      const ctx = useRound();
      triggerStart = () =>
        ctx.startRound({
          prompt: "test",
          modelsEnabled: { openai: true, gemini: false },
          count: 4,
          aspect: { kind: "discrete", ratio: "1:1" },
        });
      return (
        <span data-testid="c429-openai">{ctx.consecutive429Count.openai}</span>
      );
    }

    render(
      <RoundProvider>
        <StartConsumer />
      </RoundProvider>,
    );

    expect(screen.getByTestId("c429-openai").textContent).toBe("0");

    await act(async () => {
      triggerStart!();
    });

    await act(async () => {
      capturedOnSlotUpdate!({
        provider: "openai",
        index: 0,
        result: {
          status: "error",
          error: { kind: "rate_limited", message: "Too fast" },
        },
      });
    });

    expect(screen.getByTestId("c429-openai").textContent).toBe("1");

    await act(async () => {
      capturedOnSlotUpdate!({
        provider: "openai",
        index: 1,
        result: {
          status: "error",
          error: { kind: "rate_limited", message: "Too fast" },
        },
      });
    });

    expect(screen.getByTestId("c429-openai").textContent).toBe("2");
  });

  it("resets consecutive429Count on non-429 settle", async () => {
    const round = makeLoadingRound(2, 0);
    let capturedOnSlotUpdate: ((u: SlotUpdate) => void) | null = null;

    mockStartRoundOne.mockResolvedValue({ round, sessionId: "s1" });
    mockFanOut.mockImplementation(async (opts: { onSlotUpdate: (u: SlotUpdate) => void }) => {
      capturedOnSlotUpdate = opts.onSlotUpdate;
      return { ...round, settledAt: new Date().toISOString() };
    });

    let triggerStart: (() => void) | null = null;
    function StartConsumer() {
      const ctx = useRound();
      triggerStart = () =>
        ctx.startRound({
          prompt: "test",
          modelsEnabled: { openai: true, gemini: false },
          count: 4,
          aspect: { kind: "discrete", ratio: "1:1" },
        });
      return (
        <span data-testid="c429-openai">{ctx.consecutive429Count.openai}</span>
      );
    }

    render(
      <RoundProvider>
        <StartConsumer />
      </RoundProvider>,
    );

    await act(async () => {
      triggerStart!();
    });

    await act(async () => {
      capturedOnSlotUpdate!({
        provider: "openai",
        index: 0,
        result: {
          status: "error",
          error: { kind: "rate_limited", message: "Too fast" },
        },
      });
    });

    expect(screen.getByTestId("c429-openai").textContent).toBe("1");

    await act(async () => {
      capturedOnSlotUpdate!({
        provider: "openai",
        index: 1,
        result: {
          status: "success",
          bytes: new ArrayBuffer(1),
          thumbnail: new ArrayBuffer(1),
          mimeType: "image/png",
          meta: {},
        },
      });
    });

    expect(screen.getByTestId("c429-openai").textContent).toBe("0");
  });

  it("per-provider isolation: OpenAI 429 does not affect Gemini count", async () => {
    const round = makeLoadingRound(1, 1);
    let capturedOnSlotUpdate: ((u: SlotUpdate) => void) | null = null;

    mockStartRoundOne.mockResolvedValue({ round, sessionId: "s1" });
    mockFanOut.mockImplementation(async (opts: { onSlotUpdate: (u: SlotUpdate) => void }) => {
      capturedOnSlotUpdate = opts.onSlotUpdate;
      return { ...round, settledAt: new Date().toISOString() };
    });

    let triggerStart: (() => void) | null = null;
    function StartConsumer() {
      const ctx = useRound();
      triggerStart = () =>
        ctx.startRound({
          prompt: "test",
          modelsEnabled: { openai: true, gemini: true },
          count: 4,
          aspect: { kind: "discrete", ratio: "1:1" },
        });
      return (
        <div>
          <span data-testid="c429-openai">{ctx.consecutive429Count.openai}</span>
          <span data-testid="c429-gemini">{ctx.consecutive429Count.gemini}</span>
        </div>
      );
    }

    render(
      <RoundProvider>
        <StartConsumer />
      </RoundProvider>,
    );

    await act(async () => {
      triggerStart!();
    });

    await act(async () => {
      capturedOnSlotUpdate!({
        provider: "openai",
        index: 0,
        result: {
          status: "error",
          error: { kind: "rate_limited", message: "Too fast" },
        },
      });
    });

    expect(screen.getByTestId("c429-openai").textContent).toBe("1");
    expect(screen.getByTestId("c429-gemini").textContent).toBe("0");
  });
});

describe("RoundProvider selections", () => {
  it("starts with empty selections", () => {
    render(
      <RoundProvider>
        <Consumer />
      </RoundProvider>,
    );
    expect(screen.getByTestId("selections").textContent).toBe("0");
  });

  it("toggleSelection adds and removes selections", () => {
    let toggle: ((p: "openai" | "gemini", i: number) => void) | null = null;
    function SelectionConsumer() {
      const ctx = useRound();
      toggle = ctx.toggleSelection;
      return (
        <div>
          <span data-testid="selections">{ctx.selections.length}</span>
          <span data-testid="sel-detail">
            {ctx.selections.map((s) => `${s.provider}:${s.index}`).join(",")}
          </span>
        </div>
      );
    }

    render(
      <RoundProvider>
        <SelectionConsumer />
      </RoundProvider>,
    );

    act(() => { toggle!("openai", 0); });
    expect(screen.getByTestId("selections").textContent).toBe("1");
    expect(screen.getByTestId("sel-detail").textContent).toBe("openai:0");

    act(() => { toggle!("gemini", 2); });
    expect(screen.getByTestId("selections").textContent).toBe("2");

    act(() => { toggle!("openai", 0); });
    expect(screen.getByTestId("selections").textContent).toBe("1");
    expect(screen.getByTestId("sel-detail").textContent).toBe("gemini:2");
  });

  it("enforces MAX_SELECTIONS cap of 4", () => {
    let toggle: ((p: "openai" | "gemini", i: number) => void) | null = null;
    function SelectionConsumer() {
      const ctx = useRound();
      toggle = ctx.toggleSelection;
      return <span data-testid="selections">{ctx.selections.length}</span>;
    }

    render(
      <RoundProvider>
        <SelectionConsumer />
      </RoundProvider>,
    );

    act(() => { toggle!("openai", 0); });
    act(() => { toggle!("openai", 1); });
    act(() => { toggle!("openai", 2); });
    act(() => { toggle!("openai", 3); });
    expect(screen.getByTestId("selections").textContent).toBe("4");

    act(() => { toggle!("gemini", 0); });
    expect(screen.getByTestId("selections").textContent).toBe("4");
  });

  it("clears selections when starting a new round", async () => {
    const round = makeLoadingRound(2, 0);
    mockStartRoundOne.mockResolvedValue({ round, sessionId: "s1" });
    mockFanOut.mockResolvedValue({ ...round, settledAt: new Date().toISOString() });

    let toggle: ((p: "openai" | "gemini", i: number) => void) | null = null;
    let start: (() => void) | null = null;
    function SelectionConsumer() {
      const ctx = useRound();
      toggle = ctx.toggleSelection;
      start = () =>
        ctx.startRound({
          prompt: "test",
          modelsEnabled: { openai: true, gemini: false },
          count: 4,
          aspect: { kind: "discrete", ratio: "1:1" },
        });
      return <span data-testid="selections">{ctx.selections.length}</span>;
    }

    render(
      <RoundProvider>
        <SelectionConsumer />
      </RoundProvider>,
    );

    act(() => { toggle!("openai", 0); });
    expect(screen.getByTestId("selections").textContent).toBe("1");

    await act(async () => { start!(); });
    expect(screen.getByTestId("selections").textContent).toBe("0");
  });
});
