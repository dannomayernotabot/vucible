import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { WizardContext } from "./WizardContext";
import type { WizardState } from "@/lib/wizard/machine";
import type { WizardAction } from "@/lib/wizard/machine";
import { WIZARD_COPY } from "@/lib/wizard/copy";
import { StepIntro } from "./StepIntro";
import { StepKeys } from "./StepKeys";
import { StepDefaults } from "./StepDefaults";
import { StepConfirm } from "./StepConfirm";

afterEach(cleanup);

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    step: 1,
    draftProviders: {},
    draftDefaults: {},
    completed: false,
    ...overrides,
  };
}

function Wrapper({
  state,
  dispatch,
  children,
}: {
  state: WizardState;
  dispatch: (action: WizardAction) => void;
  children: ReactNode;
}) {
  return (
    <WizardContext value={{ state, dispatch }}>
      {children}
    </WizardContext>
  );
}

describe("StepIntro", () => {
  it("renders title and body from copy", () => {
    render(
      <Wrapper state={makeState()} dispatch={vi.fn()}>
        <StepIntro />
      </Wrapper>,
    );
    expect(screen.getByText(WIZARD_COPY.step1.title)).toBeDefined();
    expect(screen.getByText(WIZARD_COPY.step1.body)).toBeDefined();
  });

  it("dispatches set-step:2 when CTA clicked", () => {
    const dispatch = vi.fn();
    render(
      <Wrapper state={makeState()} dispatch={dispatch}>
        <StepIntro />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "set-step", step: 2 });
  });
});

describe("StepKeys", () => {
  it("renders header and provider cards", () => {
    render(
      <Wrapper state={makeState({ step: 2 })} dispatch={vi.fn()}>
        <StepKeys />
      </Wrapper>,
    );
    expect(screen.getByText(WIZARD_COPY.step2.header)).toBeDefined();
  });

  it("disables Continue when no provider validated", () => {
    render(
      <Wrapper state={makeState({ step: 2 })} dispatch={vi.fn()}>
        <StepKeys />
      </Wrapper>,
    );
    const continueBtn = screen.getByRole("button", { name: /Next/i });
    expect(continueBtn.hasAttribute("disabled")).toBe(true);
  });

  it("enables Continue when at least one provider validated", () => {
    const state = makeState({
      step: 2,
      draftProviders: {
        openai: {
          apiKey: "sk-test",
          tier: "tier2",
          ipm: 20,
          validatedAt: "2025-06-01T00:00:00.000Z",
        },
      },
    });
    render(
      <Wrapper state={state} dispatch={vi.fn()}>
        <StepKeys />
      </Wrapper>,
    );
    const continueBtn = screen.getByRole("button", { name: /Next/i });
    expect(continueBtn.hasAttribute("disabled")).toBe(false);
  });

  it("dispatches set-step:1 when Back clicked", () => {
    const dispatch = vi.fn();
    render(
      <Wrapper state={makeState({ step: 2 })} dispatch={dispatch}>
        <StepKeys />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "set-step", step: 1 });
  });
});

describe("StepDefaults", () => {
  it("renders header and picker labels", () => {
    render(
      <Wrapper state={makeState({ step: 3 })} dispatch={vi.fn()}>
        <StepDefaults />
      </Wrapper>,
    );
    expect(screen.getByText(WIZARD_COPY.step3.header)).toBeDefined();
    expect(screen.getByText(WIZARD_COPY.step3.imageCount.label)).toBeDefined();
    expect(screen.getByText(WIZARD_COPY.step3.aspectRatio.label)).toBeDefined();
  });

  it("renders DiscreteRatioGrid when Gemini validated", () => {
    const state = makeState({
      step: 3,
      draftProviders: {
        gemini: {
          apiKey: "ai-test",
          tier: "tier1",
          ipm: 5,
          validatedAt: "2025-06-01T00:00:00.000Z",
        },
      },
    });
    render(
      <Wrapper state={state} dispatch={vi.fn()}>
        <StepDefaults />
      </Wrapper>,
    );
    expect(screen.getByRole("radiogroup", { name: "Aspect ratio" })).toBeDefined();
  });

  it("renders FreeformRatioInput when only OpenAI validated", () => {
    const state = makeState({
      step: 3,
      draftProviders: {
        openai: {
          apiKey: "sk-test",
          tier: "tier2",
          ipm: 20,
          validatedAt: "2025-06-01T00:00:00.000Z",
        },
      },
    });
    render(
      <Wrapper state={state} dispatch={vi.fn()}>
        <StepDefaults />
      </Wrapper>,
    );
    expect(screen.getByLabelText("Width")).toBeDefined();
    expect(screen.queryByRole("radiogroup", { name: "Aspect ratio" })).toBeNull();
  });

  it("dispatches set-step:4 when Continue clicked", () => {
    const dispatch = vi.fn();
    render(
      <Wrapper state={makeState({ step: 3 })} dispatch={dispatch}>
        <StepDefaults />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "set-step", step: 4 });
  });
});

describe("StepConfirm", () => {
  const validatedState = makeState({
    step: 4,
    draftProviders: {
      openai: {
        apiKey: "sk-test",
        tier: "tier2",
        ipm: 20,
        validatedAt: "2025-06-01T00:00:00.000Z",
      },
    },
    draftDefaults: {
      imageCount: 8,
      aspectRatio: { kind: "discrete", ratio: "16:9" },
    },
  });

  it("renders header and body from copy", () => {
    render(
      <Wrapper state={validatedState} dispatch={vi.fn()}>
        <StepConfirm />
      </Wrapper>,
    );
    expect(screen.getByText(WIZARD_COPY.step4.header)).toBeDefined();
  });

  it("shows validated providers with tier badges", () => {
    render(
      <Wrapper state={validatedState} dispatch={vi.fn()}>
        <StepConfirm />
      </Wrapper>,
    );
    expect(screen.getByText("OpenAI")).toBeDefined();
    expect(screen.getByText(/Tier 2/)).toBeDefined();
  });

  it("shows image count and aspect ratio defaults", () => {
    render(
      <Wrapper state={validatedState} dispatch={vi.fn()}>
        <StepConfirm />
      </Wrapper>,
    );
    expect(screen.getByText("8")).toBeDefined();
    expect(screen.getByText("16:9")).toBeDefined();
  });

  it("shows freeform dimensions when aspect is freeform", () => {
    const state = makeState({
      step: 4,
      draftProviders: {
        openai: {
          apiKey: "sk-test",
          tier: "tier2",
          ipm: 20,
          validatedAt: "2025-06-01T00:00:00.000Z",
        },
      },
      draftDefaults: {
        imageCount: 4,
        aspectRatio: { kind: "freeform", width: 800, height: 600 },
      },
    });
    render(
      <Wrapper state={state} dispatch={vi.fn()}>
        <StepConfirm />
      </Wrapper>,
    );
    expect(screen.getByText("800×600")).toBeDefined();
  });

  it("shows FreeTierWarning when Gemini is on free tier", () => {
    const state = makeState({
      step: 4,
      draftProviders: {
        gemini: {
          apiKey: "ai-test",
          tier: "free",
          ipm: 0,
          validatedAt: "2025-06-01T00:00:00.000Z",
        },
      },
    });
    render(
      <Wrapper state={state} dispatch={vi.fn()}>
        <StepConfirm />
      </Wrapper>,
    );
    expect(
      screen.getByText(/Free Gemini API tier does not include/i),
    ).toBeDefined();
  });

  it("does not show FreeTierWarning when Gemini is paid", () => {
    render(
      <Wrapper state={validatedState} dispatch={vi.fn()}>
        <StepConfirm />
      </Wrapper>,
    );
    expect(
      screen.queryByText(/Free Gemini API tier does not include/i),
    ).toBeNull();
  });

  it("dispatches complete when final CTA clicked", () => {
    const dispatch = vi.fn();
    render(
      <Wrapper state={validatedState} dispatch={dispatch}>
        <StepConfirm />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Start Creating/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "complete" });
  });

  it("dispatches set-step:3 when Back clicked", () => {
    const dispatch = vi.fn();
    render(
      <Wrapper state={validatedState} dispatch={dispatch}>
        <StepConfirm />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "set-step", step: 3 });
  });
});
