/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WizardShell } from "./WizardShell";

vi.mock("@/lib/providers/openai", () => ({
  testGenerate: vi.fn(),
  listImageModels: vi.fn(),
}));

vi.mock("@/lib/providers/gemini", () => ({
  listModels: vi.fn(),
}));

import { testGenerate, listImageModels } from "@/lib/providers/openai";
import { listModels } from "@/lib/providers/gemini";

const mockTestGenerate = testGenerate as ReturnType<typeof vi.fn>;
const mockListImageModels = listImageModels as ReturnType<typeof vi.fn>;
const mockListModels = listModels as ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("wizard happy path", () => {
  it("completes full wizard flow: intro → keys → defaults → confirm", async () => {
    mockTestGenerate.mockResolvedValue({
      ok: true,
      tier: "tier2",
      ipm: 20,
    });
    mockListImageModels.mockResolvedValue({
      ok: true,
      models: ["gpt-image-1"],
    });
    mockListModels.mockResolvedValue({ ok: true });

    const onComplete = vi.fn();
    render(<WizardShell onComplete={onComplete} />);

    expect(screen.getByText("Welcome to Vucible")).toBeDefined();
    expect(screen.getByText("Step 1 of 4")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Get Started/ }));

    expect(screen.getByText("Step 2 of 4")).toBeDefined();
    expect(screen.getByText("Connect Your API Keys")).toBeDefined();

    const inputs = screen.getAllByDisplayValue("");
    const openaiInput = inputs.find(
      (el) => el.getAttribute("aria-label") === "OpenAI API Key",
    )!;
    fireEvent.change(openaiInput, {
      target: { value: "sk-test1234567890abcdefghijklmnop" },
    });

    const testButtons = screen.getAllByText("Test Key");
    fireEvent.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Tier 2 — 20 images/min")).toBeDefined();
    });

    const nextButton = screen.getByText("Next →");
    expect(nextButton).not.toBeNull();
    fireEvent.click(nextButton);

    expect(screen.getByText("Step 3 of 4")).toBeDefined();
    expect(screen.getByText("Set Your Defaults")).toBeDefined();

    fireEvent.click(screen.getByText("Next →"));

    expect(screen.getByText("Step 4 of 4")).toBeDefined();
    expect(screen.getByText("Ready to Go")).toBeDefined();
    expect(screen.getByText("OpenAI")).toBeDefined();

    fireEvent.click(screen.getByText("Start Creating →"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledOnce();
    });
  });
});

describe("wizard sad path", () => {
  it("shows error on invalid key, then recovers", async () => {
    mockTestGenerate
      .mockResolvedValueOnce({
        ok: false,
        error: { kind: "auth_failed", message: "Invalid key" },
      })
      .mockResolvedValueOnce({
        ok: true,
        tier: "tier1",
        ipm: 5,
      });

    const onComplete = vi.fn();
    render(<WizardShell onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: /Get Started/ }));

    const openaiInput = screen.getByLabelText("OpenAI API Key");
    fireEvent.change(openaiInput, {
      target: { value: "sk-badkey1234567890abcdefghijklmn" },
    });

    fireEvent.click(screen.getAllByText("Test Key")[0]);

    await waitFor(() => {
      expect(
        screen.getByText("Re-check the key and try again."),
      ).toBeDefined();
    });

    const freshInput = screen.getByLabelText("OpenAI API Key");
    fireEvent.change(freshInput, {
      target: { value: "sk-goodkey234567890abcdefghijklmn" },
    });

    await waitFor(() => {
      const btns = screen.getAllByText("Test Key");
      expect(btns.length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText("Test Key")[0]);

    await waitFor(() => {
      expect(screen.getByText("Tier 1 — 5 images/min")).toBeDefined();
    });
  });

  it("disables Continue until a provider is validated", () => {
    render(<WizardShell onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Get Started/ }));

    const nextButton = screen.getByText("Next →");
    expect(nextButton.hasAttribute("disabled")).toBe(true);
  });
});
