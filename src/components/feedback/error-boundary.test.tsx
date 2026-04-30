/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RootErrorBoundary } from "./RootErrorBoundary";
import { RoundErrorBoundary } from "@/components/round/RoundErrorBoundary";
import { HistoryErrorBoundary } from "@/components/history/HistoryErrorBoundary";

function ThrowOnRender({ message }: { message: string }) {
  throw new Error(message);
}

afterEach(cleanup);

describe("RootErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <RootErrorBoundary>
        <span>safe content</span>
      </RootErrorBoundary>,
    );
    expect(screen.getByText("safe content")).toBeDefined();
  });

  it("catches child error and shows fallback UI", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <RootErrorBoundary>
        <ThrowOnRender message="root error" />
      </RootErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDefined();
    consoleSpy.mockRestore();
  });

  it("logs error to console.error", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <RootErrorBoundary>
        <ThrowOnRender message="log test" />
      </RootErrorBoundary>,
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      "[RootErrorBoundary]",
      expect.any(Error),
      expect.any(String),
    );
    consoleSpy.mockRestore();
  });

  it("other children remain unaffected when sibling boundary catches error", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <div>
        <span>always visible</span>
        <RoundErrorBoundary>
          <ThrowOnRender message="round error" />
        </RoundErrorBoundary>
      </div>,
    );
    expect(screen.getByText("always visible")).toBeDefined();
    expect(screen.getByRole("alert")).toBeDefined();
    consoleSpy.mockRestore();
  });
});

describe("RoundErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <RoundErrorBoundary>
        <span>round content</span>
      </RoundErrorBoundary>,
    );
    expect(screen.getByText("round content")).toBeDefined();
  });

  it("catches child error and shows round error fallback", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <RoundErrorBoundary>
        <ThrowOnRender message="round throw" />
      </RoundErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Round display failed")).toBeDefined();
    consoleSpy.mockRestore();
  });

  it("logs error with correct prefix", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <RoundErrorBoundary>
        <ThrowOnRender message="round log test" />
      </RoundErrorBoundary>,
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      "[RoundErrorBoundary]",
      expect.any(Error),
      expect.any(String),
    );
    consoleSpy.mockRestore();
  });
});

describe("HistoryErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <HistoryErrorBoundary>
        <span>history content</span>
      </HistoryErrorBoundary>,
    );
    expect(screen.getByText("history content")).toBeDefined();
  });

  it("catches child error and shows history unavailable fallback", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <HistoryErrorBoundary>
        <ThrowOnRender message="history throw" />
      </HistoryErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("History unavailable")).toBeDefined();
    consoleSpy.mockRestore();
  });

  it("main canvas unaffected when history throws", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <div>
        <main>
          <span>main canvas</span>
        </main>
        <aside>
          <HistoryErrorBoundary>
            <ThrowOnRender message="history error" />
          </HistoryErrorBoundary>
        </aside>
      </div>,
    );
    expect(screen.getByText("main canvas")).toBeDefined();
    expect(screen.getByRole("alert")).toBeDefined();
    consoleSpy.mockRestore();
  });

  it("logs error with correct prefix", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <HistoryErrorBoundary>
        <ThrowOnRender message="history log test" />
      </HistoryErrorBoundary>,
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      "[HistoryErrorBoundary]",
      expect.any(Error),
      expect.any(String),
    );
    consoleSpy.mockRestore();
  });
});
