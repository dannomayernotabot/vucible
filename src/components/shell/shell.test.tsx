/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";
import { TopBar } from "./TopBar";
import { ThemeProvider } from "./ThemeProvider";

vi.mock("@/lib/storage/history", () => ({
  findOrphanRounds: vi.fn().mockResolvedValue([]),
  markRoundOrphaned: vi.fn().mockResolvedValue(undefined),
}));

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

  it("renders history button (disabled stub)", () => {
    render(
      <ThemeProvider>
        <TopBar />
      </ThemeProvider>,
    );
    const btn = screen.getByRole("button", { name: "History" });
    expect(btn).toBeDefined();
    expect(btn.hasAttribute("disabled")).toBe(true);
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
      <AppShell>
        <div data-testid="child">content</div>
      </AppShell>,
    );
    expect(screen.getByText("vucible")).toBeDefined();
    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("renders without children", () => {
    render(<AppShell />);
    expect(screen.getByText("vucible")).toBeDefined();
  });
});
