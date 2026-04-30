import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { RateLimitBanner } from "./RateLimitBanner";
import type { Provider } from "@/lib/providers/types";

const mockConsecutive429Count: Record<Provider, number> = { openai: 0, gemini: 0 };

vi.mock("@/components/round/RoundProvider", () => ({
  useRound: () => ({
    consecutive429Count: { ...mockConsecutive429Count },
  }),
}));

afterEach(() => {
  cleanup();
  mockConsecutive429Count.openai = 0;
  mockConsecutive429Count.gemini = 0;
});

describe("RateLimitBanner", () => {
  it("does not render when 429 count is below threshold", () => {
    mockConsecutive429Count.openai = 2;
    const { container } = render(<RateLimitBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("renders OpenAI banner when count reaches 3", () => {
    mockConsecutive429Count.openai = 3;
    render(<RateLimitBanner />);
    expect(screen.getByText(/Hit your OpenAI rate limit/)).toBeDefined();
  });

  it("renders Gemini banner when count reaches 3", () => {
    mockConsecutive429Count.gemini = 5;
    render(<RateLimitBanner />);
    expect(screen.getByText(/Hit your Gemini rate limit/)).toBeDefined();
  });

  it("renders both banners when both exceed threshold", () => {
    mockConsecutive429Count.openai = 3;
    mockConsecutive429Count.gemini = 3;
    render(<RateLimitBanner />);
    expect(screen.getByText(/Hit your OpenAI rate limit/)).toBeDefined();
    expect(screen.getByText(/Hit your Gemini rate limit/)).toBeDefined();
  });

  it("per-provider isolation: OpenAI at 3 does not show Gemini banner", () => {
    mockConsecutive429Count.openai = 3;
    mockConsecutive429Count.gemini = 1;
    render(<RateLimitBanner />);
    expect(screen.getByText(/Hit your OpenAI rate limit/)).toBeDefined();
    expect(screen.queryByText(/Hit your Gemini rate limit/)).toBeNull();
  });

  it("dismiss button hides banner for current round", () => {
    mockConsecutive429Count.openai = 3;
    render(<RateLimitBanner />);
    expect(screen.getByText(/Hit your OpenAI rate limit/)).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss openai rate limit warning" }),
    );

    expect(screen.queryByText(/Hit your OpenAI rate limit/)).toBeNull();
  });
});
