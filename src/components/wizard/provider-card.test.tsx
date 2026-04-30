import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useReducer } from "react";
import { http, HttpResponse, delay } from "msw";
import { server } from "../../../vitest.setup";
import { wizardReducer, initialState } from "@/lib/wizard/machine";
import type { WizardState, WizardAction } from "@/lib/wizard/machine";
import { WizardContext } from "./WizardContext";
import { ProviderCard } from "./ProviderCard";
import { KeyPasteField } from "./KeyPasteField";
import { ValidationStatus } from "./ValidationStatus";

afterEach(cleanup);

const OPENAI_URL = "https://api.openai.com/v1/images/generations";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models*";

function Wrapper({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: WizardState;
}) {
  const [state, dispatch] = useReducer(
    wizardReducer,
    initial ?? initialState(null),
  );
  return (
    <WizardContext value={{ state, dispatch }}>{children}</WizardContext>
  );
}

function StaticWrapper({
  children,
  state,
  dispatch,
}: {
  children: React.ReactNode;
  state: WizardState;
  dispatch: (a: WizardAction) => void;
}) {
  return (
    <WizardContext value={{ state, dispatch }}>{children}</WizardContext>
  );
}

function stateWith(overrides: Partial<WizardState>): WizardState {
  return { ...initialState(null), ...overrides };
}

describe("ProviderCard", () => {
  it("renders header with label and API key link for OpenAI", () => {
    render(
      <Wrapper>
        <ProviderCard provider="openai" />
      </Wrapper>,
    );
    expect(screen.getByText("OpenAI API Key")).toBeDefined();
    const link = screen.getByRole("link", { name: /Get an API key/ });
    expect(link.getAttribute("href")).toBe(
      "https://platform.openai.com/api-keys",
    );
  });

  it("renders header with label and API key link for Gemini", () => {
    render(
      <Wrapper>
        <ProviderCard provider="gemini" />
      </Wrapper>,
    );
    expect(screen.getByText("Gemini API Key")).toBeDefined();
    const link = screen.getByRole("link", { name: /Get an API key/ });
    expect(link.getAttribute("href")).toBe(
      "https://aistudio.google.com/apikey",
    );
  });
});

describe("KeyPasteField", () => {
  it("renders input with placeholder", () => {
    render(
      <Wrapper>
        <KeyPasteField provider="openai" />
      </Wrapper>,
    );
    const input = screen.getByPlaceholderText("sk-...");
    expect(input).toBeDefined();
  });

  it("disables Validate when key is not plausible", () => {
    render(
      <Wrapper
        initial={stateWith({
          draftProviders: { openai: { apiKey: "short" } },
        })}
      >
        <KeyPasteField provider="openai" />
      </Wrapper>,
    );
    const btn = screen.getByRole("button", { name: /Test Key/i });
    expect(btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true").toBe(true);
  });

  it("enables Validate when key is plausible", () => {
    render(
      <Wrapper
        initial={stateWith({
          draftProviders: {
            openai: { apiKey: "sk-proj-abc123def456ghi789jklmnop" },
          },
        })}
      >
        <KeyPasteField provider="openai" />
      </Wrapper>,
    );
    const btn = screen.getByRole("button", { name: /Test Key/i });
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  it("sets input readOnly during validation and shows spinner text", async () => {
    server.use(
      http.post(OPENAI_URL, async () => {
        await delay(500);
        return HttpResponse.json(
          { data: [{ b64_json: "abc" }] },
          { headers: { "x-ratelimit-limit-images": "20" } },
        );
      }),
    );

    render(
      <Wrapper
        initial={stateWith({
          draftProviders: {
            openai: { apiKey: "sk-proj-abc123def456ghi789jklmnop" },
          },
        })}
      >
        <KeyPasteField provider="openai" />
        <ValidationStatus provider="openai" />
      </Wrapper>,
    );

    const btn = screen.getByRole("button", { name: /Test Key/i });
    await act(async () => {
      fireEvent.click(btn);
    });

    const input = screen.getByLabelText("OpenAI API Key");
    expect(input.getAttribute("readonly")).not.toBeNull();
    expect(screen.getByText("Generating test image…")).toBeDefined();
  });

  it("shows Clear button and TierBadge after successful OpenAI validation", async () => {
    server.use(
      http.post(OPENAI_URL, () => {
        return HttpResponse.json(
          { data: [{ b64_json: "abc" }] },
          { headers: { "x-ratelimit-limit-images": "20" } },
        );
      }),
    );

    render(
      <Wrapper
        initial={stateWith({
          draftProviders: {
            openai: { apiKey: "sk-proj-abc123def456ghi789jklmnop" },
          },
        })}
      >
        <KeyPasteField provider="openai" />
        <ValidationStatus provider="openai" />
      </Wrapper>,
    );

    const btn = screen.getByRole("button", { name: /Test Key/i });
    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(screen.getByText("Clear")).toBeDefined();
    });

    expect(screen.getByText(/Tier 2/)).toBeDefined();
    expect(screen.getByText(/20 images\/min/)).toBeDefined();
  });

  it("shows error message and unlocks input on validation failure", async () => {
    server.use(
      http.post(OPENAI_URL, () => {
        return HttpResponse.json(
          { error: { message: "Incorrect API key provided" } },
          { status: 401 },
        );
      }),
    );

    render(
      <Wrapper
        initial={stateWith({
          draftProviders: {
            openai: { apiKey: "sk-proj-abc123def456ghi789jklmnop" },
          },
        })}
      >
        <KeyPasteField provider="openai" />
        <ValidationStatus provider="openai" />
      </Wrapper>,
    );

    const btn = screen.getByRole("button", { name: /Test Key/i });
    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Re-check the key and try again/),
      ).toBeDefined();
    });

    const input = screen.getByLabelText("OpenAI API Key");
    expect(input.getAttribute("readonly")).toBeNull();
  });

  it("rage-clicking Validate fires only one testGenerate call", async () => {
    let callCount = 0;
    server.use(
      http.post(OPENAI_URL, async () => {
        callCount++;
        await delay(200);
        return HttpResponse.json(
          { data: [{ b64_json: "abc" }] },
          { headers: { "x-ratelimit-limit-images": "20" } },
        );
      }),
    );

    render(
      <Wrapper
        initial={stateWith({
          draftProviders: {
            openai: { apiKey: "sk-proj-abc123def456ghi789jklmnop" },
          },
        })}
      >
        <KeyPasteField provider="openai" />
      </Wrapper>,
    );

    const btn = screen.getByRole("button", { name: /Test Key/i });

    await act(async () => {
      fireEvent.click(btn);
    });
    // After first click + act, button should be disabled
    await act(async () => {
      fireEvent.click(btn);
    });
    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(screen.getByText("Clear")).toBeDefined();
    });

    expect(callCount).toBe(1);
  });

  it("Clear button removes provider and re-enables input", async () => {
    server.use(
      http.post(OPENAI_URL, () => {
        return HttpResponse.json(
          { data: [{ b64_json: "abc" }] },
          { headers: { "x-ratelimit-limit-images": "20" } },
        );
      }),
    );

    render(
      <Wrapper
        initial={stateWith({
          draftProviders: {
            openai: { apiKey: "sk-proj-abc123def456ghi789jklmnop" },
          },
        })}
      >
        <KeyPasteField provider="openai" />
        <ValidationStatus provider="openai" />
      </Wrapper>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Test Key/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("Clear")).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Clear"));
    });

    const input = screen.getByLabelText("OpenAI API Key");
    expect(input.getAttribute("readonly")).toBeNull();
    expect((input as HTMLInputElement).value).toBe("");
  });
});

describe("KeyPasteField (Gemini)", () => {
  it("validates Gemini via listModels and shows TierDropdown", async () => {
    server.use(
      http.get(GEMINI_URL, () => {
        return HttpResponse.json({ models: [{ name: "gemini-2.0-flash" }] });
      }),
    );

    render(
      <Wrapper
        initial={stateWith({
          draftProviders: {
            gemini: { apiKey: "AIzaSyAbc123def456ghi789jklmnop" },
          },
        })}
      >
        <KeyPasteField provider="gemini" />
        <ValidationStatus provider="gemini" />
      </Wrapper>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Test Key/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("Clear")).toBeDefined();
    });

    expect(screen.getByText(/Key verified/)).toBeDefined();
    expect(screen.getByLabelText("Select Gemini tier")).toBeDefined();
  });
});

describe("ValidationStatus", () => {
  it("returns null when no draft exists", () => {
    const { container } = render(
      <Wrapper>
        <ValidationStatus provider="openai" />
      </Wrapper>,
    );
    expect(container.textContent).toBe("");
  });

  it("shows spinner with OpenAI text during validation", () => {
    render(
      <StaticWrapper
        state={stateWith({
          draftProviders: {
            openai: { apiKey: "sk-test", validating: true },
          },
        })}
        dispatch={() => {}}
      >
        <ValidationStatus provider="openai" />
      </StaticWrapper>,
    );
    expect(screen.getByText("Generating test image…")).toBeDefined();
  });

  it("shows spinner with Gemini text during validation", () => {
    render(
      <StaticWrapper
        state={stateWith({
          draftProviders: {
            gemini: { apiKey: "AIza-test", validating: true },
          },
        })}
        dispatch={() => {}}
      >
        <ValidationStatus provider="gemini" />
      </StaticWrapper>,
    );
    expect(screen.getByText("Checking…")).toBeDefined();
  });

  it("shows error message from errorToMessage", () => {
    render(
      <StaticWrapper
        state={stateWith({
          draftProviders: {
            openai: {
              apiKey: "sk-test",
              error: { kind: "auth_failed", message: "bad key" },
            },
          },
        })}
        dispatch={() => {}}
      >
        <ValidationStatus provider="openai" />
      </StaticWrapper>,
    );
    expect(screen.getByText(/Re-check the key and try again/)).toBeDefined();
  });

  it("shows TierBadge for OpenAI success", () => {
    render(
      <StaticWrapper
        state={stateWith({
          draftProviders: {
            openai: {
              apiKey: "sk-test",
              tier: "tier2",
              ipm: 20,
              validatedAt: "2025-01-01T00:00:00.000Z",
            },
          },
        })}
        dispatch={() => {}}
      >
        <ValidationStatus provider="openai" />
      </StaticWrapper>,
    );
    expect(screen.getByText("Tier 2 — 20 images/min")).toBeDefined();
  });

  it("shows TierDropdown and checkmark for Gemini success", () => {
    render(
      <StaticWrapper
        state={stateWith({
          draftProviders: {
            gemini: {
              apiKey: "AIza-test",
              tier: "tier1",
              ipm: 5,
              validatedAt: "2025-01-01T00:00:00.000Z",
            },
          },
        })}
        dispatch={() => {}}
      >
        <ValidationStatus provider="gemini" />
      </StaticWrapper>,
    );
    expect(screen.getByText(/Key verified/)).toBeDefined();
    expect(screen.getByLabelText("Select Gemini tier")).toBeDefined();
  });

  it("shows FreeTierWarning when Gemini tier is free", () => {
    render(
      <StaticWrapper
        state={stateWith({
          draftProviders: {
            gemini: {
              apiKey: "AIza-test",
              tier: "free",
              ipm: 0,
              validatedAt: "2025-01-01T00:00:00.000Z",
            },
          },
        })}
        dispatch={() => {}}
      >
        <ValidationStatus provider="gemini" />
      </StaticWrapper>,
    );
    expect(
      screen.getByText(
        /Free Gemini API tier does not include image generation/,
      ),
    ).toBeDefined();
  });
});
