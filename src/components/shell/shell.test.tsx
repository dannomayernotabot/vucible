import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";
import { TopBar } from "./TopBar";

afterEach(cleanup);

describe("TopBar", () => {
  it("renders logo text", () => {
    render(<TopBar />);
    expect(screen.getByText("vucible")).toBeDefined();
  });

  it("renders history button (disabled stub)", () => {
    render(<TopBar />);
    const btn = screen.getByRole("button", { name: "History" });
    expect(btn).toBeDefined();
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("renders theme toggle button (disabled stub)", () => {
    render(<TopBar />);
    const btn = screen.getByRole("button", { name: "Toggle theme" });
    expect(btn).toBeDefined();
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("renders settings button (disabled stub)", () => {
    render(<TopBar />);
    const btn = screen.getByRole("button", { name: "Settings" });
    expect(btn).toBeDefined();
    expect(btn.hasAttribute("disabled")).toBe(true);
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
