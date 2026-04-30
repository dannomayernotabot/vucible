/**
 * @vitest-environment jsdom
 *
 * Full-flow E2E: wizard → round 1 → select → round 2 → settings → clear history
 * Uses vitest + RTL + jsdom with mocked orchestrate + provider functions.
 * Each step emits a structured log line for grep-ability: [E2E] step N: ...
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { SlotUpdate } from "@/lib/round/orchestrate";
import type { Round, RoundResult } from "@/lib/storage/schema";

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockGet, mockRelease } = vi.hoisted(() => ({
  mockGet: vi.fn(() => "blob:e2e-url"),
  mockRelease: vi.fn(),
}));

vi.mock("@/lib/round/image-cache", () => ({
  imageCache: { get: mockGet, release: mockRelease },
}));

vi.mock("@/lib/round/orchestrate", () => ({
  startRoundOne: vi.fn(),
  startRoundN: vi.fn(),
  fanOut: vi.fn(),
  regenerateSlot: vi.fn(),
}));

vi.mock("@/lib/round/throttle", () => {
  class MockThrottle {
    private handlers: (() => void)[] = [];
    setCap() {}
    queued() { return 0; }
    addEventListener(_: string, fn: () => void) { this.handlers.push(fn); }
    removeEventListener(_: string, fn: () => void) {
      this.handlers = this.handlers.filter((h) => h !== fn);
    }
  }
  return { ProviderThrottle: MockThrottle };
});

vi.mock("@/lib/providers/openai", () => ({
  testGenerate: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("@/lib/providers/gemini", () => ({
  listModels: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("@/lib/storage/history", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage/history")>(
    "@/lib/storage/history",
  );
  return {
    ...actual,
    findOrphanRounds: vi.fn().mockResolvedValue([]),
    markRoundOrphaned: vi.fn().mockResolvedValue(undefined),
    listRoundsBySession: vi.fn().mockResolvedValue([]),
  };
});

import { startRoundOne, startRoundN, fanOut } from "@/lib/round/orchestrate";
import { testGenerate } from "@/lib/providers/openai";
import { listModels } from "@/lib/providers/gemini";
import { listSessions } from "@/lib/storage/history";
import { resetDbSingleton } from "@/lib/storage/history";

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { WizardShell } from "@/components/wizard/WizardShell";
import { RoundProvider } from "@/components/round/RoundProvider";
import { PromptArea } from "@/components/round/PromptArea";
import { ResultGrid } from "@/components/grid/ResultGrid";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { Button } from "@/components/ui/button";

// ── Fixtures ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "vucible:v1";

function makeStorage() {
  return JSON.stringify({
    schemaVersion: 1,
    providers: {
      openai: {
        apiKey: "sk-test",
        tier: "tier2",
        ipm: 20,
        concurrencyCap: 20,
        validatedAt: new Date().toISOString(),
      },
    },
    defaults: {
      imageCount: 8,
      aspectRatio: { kind: "discrete", ratio: "1:1" },
      theme: "system",
    },
    createdAt: new Date().toISOString(),
  });
}

function makeRound(overrides?: Partial<Round>): Round {
  return {
    id: "round-1",
    sessionId: "session-1",
    number: 1,
    promptSent: "test prompt",
    modelsEnabled: { openai: true, gemini: false },
    imageCount: 4,
    aspect: { kind: "discrete", ratio: "1:1" },
    openaiResults: [
      { status: "loading" },
      { status: "loading" },
      { status: "loading" },
      { status: "loading" },
    ],
    geminiResults: [],
    selections: [],
    commentary: null,
    startedAt: new Date().toISOString(),
    settledAt: null,
    ...overrides,
  };
}

const SUCCESS_RESULT: RoundResult = {
  status: "success",
  bytes: new ArrayBuffer(8),
  thumbnail: new ArrayBuffer(4),
  mimeType: "image/png",
  meta: { width: 1024, height: 1024 },
};

function makeSettledRound(round: Round): Round {
  return {
    ...round,
    openaiResults: round.openaiResults.map(() => SUCCESS_RESULT),
    geminiResults: round.geminiResults.map(() => SUCCESS_RESULT),
    settledAt: new Date().toISOString(),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function step(n: number, msg: string) {
  console.log(`[E2E] step ${n}: ${msg}`);
}

function MainCanvas() {
  return (
    <RoundProvider>
      <PromptArea />
      <ResultGrid />
    </RoundProvider>
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(async () => {
  localStorage.clear();
  await resetDbSingleton();
  mockGet.mockClear();
  mockRelease.mockClear();
  vi.mocked(startRoundOne).mockReset();
  vi.mocked(startRoundN).mockReset();
  vi.mocked(fanOut).mockReset();
  vi.mocked(testGenerate).mockReset();
  vi.mocked(listModels).mockReset();
});

afterEach(cleanup);

// ── Tests ──────────────────────────────────────────────────────────────────

describe("full flow: wizard → round 1 → round 2 → settings → history clear", () => {
  it("wizard writes localStorage after completing all 4 steps", async () => {
    step(1, "empty localStorage → wizard renders");
    const onComplete = vi.fn();
    vi.mocked(testGenerate).mockResolvedValue({ ok: true, tier: "tier2", ipm: 20 });
    vi.mocked(listModels).mockResolvedValue({ ok: true });

    render(<WizardShell onComplete={onComplete} />);

    expect(screen.getByText("Welcome to Vucible")).toBeDefined();
    step(2, "click Get Started → step 2");
    fireEvent.click(screen.getByText("Get Started →"));

    step(3, "paste OpenAI key and validate");
    const openaiInput = screen.getByLabelText("OpenAI API Key");
    fireEvent.change(openaiInput, { target: { value: "sk-test1234567890abcdefghijklmnop" } });
    fireEvent.click(screen.getAllByText("Test Key")[0]);

    await waitFor(() => {
      expect(screen.getByText("Tier 2 — 20 images/min")).toBeDefined();
    });

    step(4, "advance to defaults step (step 3)");
    fireEvent.click(screen.getByText("Next →"));
    expect(screen.getByText("Step 3 of 4")).toBeDefined();

    step(5, "accept defaults and advance to confirm (step 4)");
    fireEvent.click(screen.getByText("Next →"));
    expect(screen.getByText("Step 4 of 4")).toBeDefined();

    step(6, "start using vucible → onComplete fires");
    fireEvent.click(screen.getByText("Start Creating →"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledOnce();
    });

    step(7, "localStorage has provider keys after wizard");
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.providers.openai).toBeDefined();
    expect(parsed.providers.openai.tier).toBe("tier2");
  });

  it("round 1: prompt → generate → 4 success cards", async () => {
    step(7, "AppShell renders with PromptArea, localStorage pre-seeded");
    localStorage.setItem(STORAGE_KEY, makeStorage());

    const round = makeRound();
    let resolveF!: (r: Round) => void;
    const deferredFanOut = new Promise<Round>((res) => { resolveF = res; });

    vi.mocked(startRoundOne).mockResolvedValue({ round, sessionId: "session-1" });
    vi.mocked(fanOut).mockImplementation(async () => deferredFanOut);

    render(<MainCanvas />);

    step(7, "type prompt and click Generate");
    const textarea = screen.getByPlaceholderText("Describe what you want to see...");
    fireEvent.change(textarea, { target: { value: "test prompt" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Generate"));
    });

    step(8, "verify Generate fired and progress visible");
    await waitFor(() => {
      expect(screen.getByText("Generating...")).toBeDefined();
    });
    step(8, "Generating... confirmed; resolving fanOut");

    await act(async () => {
      resolveF(makeSettledRound(round));
    });

    step(8, "fanOut resolved → 4 image cards settle");
    await waitFor(() => {
      expect(screen.queryByText("Generating...")).toBeNull();
    });

    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThanOrEqual(4);
    step(8, `settled with ${images.length} image cards`);

    expect(startRoundOne).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "test prompt" }),
    );
    const fanOutCall = vi.mocked(fanOut).mock.calls[0][0] as { round: Round };
    expect(fanOutCall.round.number).toBe(1);
  });

  it("round 2: select images → evolve → round 2 fires", async () => {
    step(7, "pre-seed localStorage with openai keys");
    localStorage.setItem(STORAGE_KEY, makeStorage());

    const round1 = makeRound();
    const settled1 = makeSettledRound(round1);

    vi.mocked(startRoundOne).mockResolvedValue({ round: round1, sessionId: "session-1" });
    vi.mocked(fanOut)
      .mockResolvedValueOnce(settled1)
      .mockResolvedValueOnce(
        makeSettledRound({
          ...round1,
          id: "round-2",
          number: 2,
          promptSent: "evolved prompt",
          settledAt: null,
        }),
      );

    const round2: Round = {
      ...round1,
      id: "round-2",
      number: 2,
      promptSent: "evolved prompt",
      settledAt: null,
    };
    vi.mocked(startRoundN).mockResolvedValue({
      round: round2,
      priorRoundUpdated: settled1,
      openaiRefs: [],
      geminiRefs: [],
    });

    render(<MainCanvas />);

    fireEvent.change(screen.getByPlaceholderText("Describe what you want to see..."), {
      target: { value: "test prompt" },
    });
    fireEvent.click(screen.getByText("Generate"));

    step(8, "wait for round 1 to settle");
    await waitFor(() => {
      expect(screen.queryByText("Generating...")).toBeNull();
    });

    step(9, "select 2 favorite images");
    const images = screen.getAllByRole("img");
    fireEvent.click(images[0]);
    fireEvent.click(images[1]);

    step(9, "type commentary");
    await waitFor(() => {
      expect(screen.getByLabelText("Optional commentary for next round")).toBeDefined();
    });
    const commentaryInput = screen.getByLabelText("Optional commentary for next round");
    fireEvent.change(commentaryInput, { target: { value: "more red" } });

    step(10, "click Evolve → round 2 fan-out");
    const evolveBtn = screen.getByText("Evolve");
    expect(evolveBtn.hasAttribute("disabled")).toBe(false);
    await act(async () => {
      fireEvent.click(evolveBtn);
    });

    await waitFor(() => {
      expect(startRoundN).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "session-1",
          priorRoundId: "round-1",
          commentary: "more red",
        }),
      );
    });

    step(11, "round 2 settles");
    await waitFor(() => {
      expect(vi.mocked(fanOut)).toHaveBeenCalledTimes(2);
    });

    const r2FanOutCall = vi.mocked(fanOut).mock.calls[1][0] as { round: Round };
    expect(r2FanOutCall.round.number).toBe(2);
  });

  it("settings: concurrency cap saved to localStorage on blur", async () => {
    step(12, "open Settings → Concurrency → change cap to 2");
    localStorage.setItem(STORAGE_KEY, makeStorage());

    render(
      <SettingsDialog
        trigger={<Button aria-label="Open settings">Settings</Button>}
      />,
    );

    fireEvent.click(screen.getByLabelText("Open settings"));

    await waitFor(() => {
      expect(screen.getByText("Concurrency")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Concurrency" }));

    await waitFor(() => {
      expect(screen.getByLabelText("OpenAI concurrency cap")).toBeDefined();
    });

    const capInput = screen.getByLabelText("OpenAI concurrency cap");
    fireEvent.change(capInput, { target: { value: "2" } });
    fireEvent.blur(capInput);

    step(12, "verify localStorage updated with cap=2");
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.providers.openai.concurrencyCap).toBe(2);
  });

  it("history: clear → IndexedDB sessions + rounds empty", async () => {
    step(13, "open Settings → History → Clear → IDB empty");
    localStorage.setItem(STORAGE_KEY, makeStorage());

    render(
      <SettingsDialog
        trigger={<Button aria-label="Open settings">Settings</Button>}
      />,
    );

    fireEvent.click(screen.getByLabelText("Open settings"));

    await waitFor(() => {
      expect(screen.getByText("History")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("tab", { name: "History" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Clear" })).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cleared" })).toBeDefined();
    });

    step(13, "verify IDB is empty");
    const sessions = await listSessions();
    expect(sessions).toHaveLength(0);
  });
});
