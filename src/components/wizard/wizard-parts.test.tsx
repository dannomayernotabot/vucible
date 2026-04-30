import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

afterEach(cleanup);
import { TierBadge } from "./TierBadge";
import { FreeTierWarning } from "./FreeTierWarning";
import { RecommendBlend } from "./RecommendBlend";
import { CostDisclosure } from "./CostDisclosure";

describe("TierBadge", () => {
  it("renders tier label and IPM", () => {
    render(<TierBadge tier="tier2" ipm={20} />);
    expect(screen.getByText("Tier 2 — 20 images/min")).toBeDefined();
  });

  it("renders free tier with destructive style", () => {
    const { container } = render(<TierBadge tier="free" ipm={0} />);
    expect(screen.getByText("Free — 0 images/min")).toBeDefined();
    expect(container.innerHTML).toContain("destructive");
  });

  it("renders all tier labels correctly", () => {
    const { rerender } = render(<TierBadge tier="tier1" ipm={5} />);
    expect(screen.getByText("Tier 1 — 5 images/min")).toBeDefined();

    rerender(<TierBadge tier="tier5" ipm={250} />);
    expect(screen.getByText("Tier 5 — 250 images/min")).toBeDefined();
  });
});

describe("FreeTierWarning", () => {
  it("renders warning text", () => {
    render(<FreeTierWarning />);
    expect(
      screen.getByText(/Free Gemini API tier does not include image generation/),
    ).toBeDefined();
  });

  it("links to AI Studio billing", () => {
    render(<FreeTierWarning />);
    const link = screen.getByRole("link", { name: /AI Studio/i });
    expect(link.getAttribute("href")).toBe(
      "https://aistudio.google.com/app/billing",
    );
    expect(link.getAttribute("target")).toBe("_blank");
  });
});

describe("RecommendBlend", () => {
  it("renders recommendation text", () => {
    render(<RecommendBlend />);
    expect(
      screen.getByText(/Use both for better results/),
    ).toBeDefined();
  });
});

describe("CostDisclosure", () => {
  it("renders cost note", () => {
    render(<CostDisclosure />);
    expect(screen.getByText(/~\$0\.04/)).toBeDefined();
  });
});
