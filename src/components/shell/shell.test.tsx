/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";
import { TopBar } from "./TopBar";
import { ThemeProvider } from "./ThemeProvider";
import { RoundProvider } from "@/components/round/RoundProvider";

vi.mock("@/lib/storage/history", () => ({
  findOrphanRounds: vi.fn().mockResolvedValue([]),
  markRoundOrphaned: vi.fn().mockResolvedValue(undefined),
  listRoundsBySession: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/round/orchestrate", () => ({
  startRoundOne: vi.fn(),
  fanOut: vi.fn(),
}));

vi.mock("@/lib/round/throttle", () => {
  class MockThrottle {
    private handlers: (() => void)[] = [];
    setCap() {}
    queued() { return 0; }
    addEventListener(_: string, fn: () => void) { this.handlers.push(fn); }
    removeEventListener(_: string, fn: () => void) { this.handlers = this.handlers.filter((h) => h !== fn); }
  }
  return { ProviderThrottle: MockThrottle };
});

afterEach(cleanup);

describe("TopBar", () => {
  it("renders logo text", () => {
    render(
      <ThemeProvider>
        <TopBar />
      </ThemeProvider>,
    );
    expect(screen.getByText("vucible")).toBeDefined();
  });

  it("renders history button (disabled when no handler)", () => {
    render(
      <ThemeProvider>
        <TopBar />
      </ThemeProvider>,
    );
    const btn = screen.getByRole("button", { name: "History" });
    expect(btn).toBeDefined();
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("renders history button (enabled when handler provided)", () => {
    render(
      <ThemeProvider>
        <TopBar onToggleHistory={() => {}} />
      </ThemeProvider>,
    );
    const btn = screen.getByRole("button", { name: "History" });
    expect(btn).toBeDefined();
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  it("renders theme toggle button (active)", () => {
    render(
      <ThemeProvider>
        <TopBar />
      </ThemeProvider>,
    );
    const btn = screen.getByRole("button", { name: "Toggle theme" });
    expect(btn).toBeDefined();
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  it("renders settings button", () => {
    render(
      <ThemeProvider>
        <TopBar />
      </ThemeProvider>,
    );
    const btn = screen.getByRole("button", { name: "Settings" });
    expect(btn).toBeDefined();
  });
});

describe("AppShell", () => {
  it("renders TopBar and children", () => {
    render(
      <RoundProvider>
        <AppShell>
          <div data-testid="child">content</div>
        </AppShell>
      </RoundProvider>,
    );
    expect(screen.getByText("vucible")).toBeDefined();
    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("renders without children", () => {
    render(
      <RoundProvider>
        <AppShell />
      </RoundProvider>,
    );
    expect(screen.getByText("vucible")).toBeDefined();
  });
});
