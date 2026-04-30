import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import { RoundProvider, useRound } from "./RoundProvider";

vi.mock("@/lib/round/orchestrate", () => ({
  startRoundOne: vi.fn(),
  fanOut: vi.fn(),
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

afterEach(cleanup);

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
    </div>
  );
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
