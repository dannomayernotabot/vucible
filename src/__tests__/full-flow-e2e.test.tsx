/**
 * @vitest-environment jsdom
 *
 * Full-flow E2E: wizard → r1 → select → r2 → settings → clear history.
 *
 * Covers the entire happy path with mocked provider APIs at the function level.
 * Each step logs structured boundaries for failure diagnosis.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { WizardShell } from "@/components/wizard/WizardShell";
import { AppShell } from "@/components/shell/AppShell";
import { RoundProvider } from "@/components/round/RoundProvider";
import { PromptArea } from "@/components/round/PromptArea";
import { ResultGrid } from "@/components/grid/ResultGrid";
import { resetDbSingleton } from "@/lib/storage/history";

vi.mock("@/lib/providers/openai", () => ({
  testGenerate: vi.fn(),
  generate: vi.fn(),
  listImageModels: vi.fn(),
}));

vi.mock("@/lib/providers/gemini", () => ({
  listModels: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("@/lib/round/thumbnails", () => ({
  generateThumbnail: vi.fn(async () => ({
    thumbnail: new ArrayBuffer(10),
    mimeType: "image/jpeg" as const,
  })),
}));

vi.mock("@/lib/round/throttle", () => {
  class MockThrottle extends EventTarget {
    private cap = 20;
    constructor(c?: number) {
      super();
      if (c) this.cap = c;
    }
    setCap(c: number) {
      this.cap = c;
    }
    queued() {
      return 0;
    }
    inflight() {
      return 0;
    }
    enqueue<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    }
    seedConsumed() {}
  }
  return { ProviderThrottle: MockThrottle };
});

vi.mock("@/lib/round/image-cache", () => {
  const urls = new Map<string, string>();
  let counter = 0;
  return {
    imageCache: {
      get: (_rid: string, key: string) => {
        if (!urls.has(key)) urls.set(key, `blob:img-${++counter}`);
        return urls.get(key)!;
      },
      release: () => {},
    },
    thumbnailCache: {
      get: (_rid: string, key: string) => {
        if (!urls.has(key)) urls.set(key, `blob:thumb-${++counter}`);
        return urls.get(key)!;
      },
      release: () => {},
    },
  };
});

import { testGenerate, listImageModels } from "@/lib/providers/openai";
import {
  generate as openaiGenerate,
} from "@/lib/providers/openai";
import { listModels, generate as geminiGenerate } from "@/lib/providers/gemini";

const mockTestGenerate = vi.mocked(testGenerate);
const mockListImageModels = vi.mocked(listImageModels);
const mockListModels = vi.mocked(listModels);
const mockOpenaiGenerate = vi.mocked(openaiGenerate);
const mockGeminiGenerate = vi.mocked(geminiGenerate);

function makeSuccess() {
  return {
    ok: true as const,
    image: new ArrayBuffer(100),
    mimeType: "image/png",
    meta: { width: 1024, height: 1024 },
  };
}

function log(step: number, msg: string) {
  console.log(`[E2E] step ${step}: ${msg}`);
}

beforeEach(async () => {
  localStorage.clear();
  await resetDbSingleton();
  mockTestGenerate.mockReset();
  mockListImageModels.mockReset();
  mockListModels.mockReset();
  mockOpenaiGenerate.mockReset();
  mockGeminiGenerate.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderApp() {
  return render(
    <RoundProvider>
      <AppShell>
        <PromptArea />
        <ResultGrid />
      </AppShell>
    </RoundProvider>,
  );
}

describe("full-flow E2E", () => {
  it(
    "wizard → r1 → select → r2 → settings concurrency → clear history",
    async () => {
      // ── Step 1: Wizard renders with empty localStorage ──
      log(1, "starting wizard with empty localStorage");
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
      const { unmount: unmountWizard } = render(
        <WizardShell onComplete={onComplete} />,
      );

      expect(screen.getByText("Welcome to Vucible")).toBeDefined();

      // ── Step 2: Complete wizard ──
      log(2, "navigating wizard: intro → keys → defaults → confirm");
      fireEvent.click(screen.getByRole("button", { name: /Get Started/ }));

      const openaiInput = screen.getByLabelText("OpenAI API Key");
      fireEvent.change(openaiInput, {
        target: { value: "sk-test1234567890abcdefghijklmnop" },
      });
      fireEvent.click(screen.getAllByText("Test Key")[0]);

      await waitFor(() => {
        expect(screen.getByText("Tier 2 — 20 images/min")).toBeDefined();
      });
      log(2, "OpenAI key validated — tier2, 20 ipm");

      fireEvent.click(screen.getByText("Next →"));
      expect(screen.getByText("Step 3 of 4")).toBeDefined();

      fireEvent.click(screen.getByText("Next →"));
      expect(screen.getByText("Step 4 of 4")).toBeDefined();

      fireEvent.click(screen.getByText("Start Creating →"));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledOnce();
      });
      log(2, "wizard complete — storage persisted");

      unmountWizard();

      // ── Step 3: AppShell renders, enter prompt ──
      log(3, "rendering AppShell with PromptArea + ResultGrid");
      mockOpenaiGenerate.mockResolvedValue(makeSuccess());

      renderApp();

      expect(screen.getByText("vucible")).toBeDefined();
      const promptInput = screen.getByLabelText("Prompt");
      expect(promptInput).toBeDefined();

      // ── Step 4: Generate round 1 ──
      log(4, "typing prompt and clicking Generate");
      fireEvent.change(promptInput, {
        target: { value: "a red sunset over mountains" },
      });

      const generateBtn = screen.getByRole("button", { name: "Generate" });
      expect(generateBtn.hasAttribute("disabled")).toBe(false);

      await act(async () => {
        fireEvent.click(generateBtn);
      });

      log(4, "waiting for round 1 to settle");
      await waitFor(
        () => {
          const images = screen.getAllByRole("img");
          expect(images.length).toBeGreaterThanOrEqual(1);
        },
        { timeout: 5000 },
      );

      const r1ImageCount = screen.getAllByRole("img").length;
      log(4, `round 1 settled — ${r1ImageCount} images rendered`);
      expect(r1ImageCount).toBeGreaterThanOrEqual(4);

      // ── Step 5: Select 2 favorites ──
      log(5, "selecting 2 favorites");
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);

      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      await waitFor(() => {
        expect(screen.getByText(/Selected: 2/)).toBeDefined();
      });
      log(5, "2 selections confirmed");

      // ── Step 6: Type commentary ──
      log(6, "entering commentary");
      const commentaryInput = screen.getByPlaceholderText(
        /more vibrant/i,
      );
      expect(commentaryInput).toBeDefined();
      fireEvent.change(commentaryInput, {
        target: { value: "more red" },
      });
      log(6, "commentary entered: 'more red'");

      // ── Step 7: Click Evolve for round 2 ──
      log(7, "clicking Evolve — expecting round 2 fan-out");
      const r1CallCount = mockOpenaiGenerate.mock.calls.length;

      const evolveBtn = screen.getByRole("button", { name: "Evolve" });
      expect(evolveBtn.hasAttribute("disabled")).toBe(false);

      fireEvent.click(evolveBtn);

      // evolveRound is async (fire-and-forget .then chain).
      // Wait until openaiGenerate accumulates new calls from round 2 fanOut.
      log(7, "waiting for round 2 fan-out to complete");
      await waitFor(
        () => {
          const newCalls = mockOpenaiGenerate.mock.calls.length - r1CallCount;
          expect(newCalls).toBeGreaterThanOrEqual(1);
        },
        { timeout: 10000 },
      );

      // Let React state settle from fanOut onSlotUpdate callbacks
      await act(async () => {});

      const r2ImageCount = screen.getAllByRole("img").length;
      const r2Calls = mockOpenaiGenerate.mock.calls.length - r1CallCount;
      log(7, `round 2 settled — ${r2ImageCount} images, ${r2Calls} generate calls`);

      // ── Step 8: Open Settings → change concurrency ──
      log(8, "opening Settings dialog");
      const settingsBtn = screen.getByRole("button", { name: "Settings" });
      fireEvent.click(settingsBtn);

      await waitFor(() => {
        expect(screen.getByText("Settings")).toBeDefined();
      });

      log(8, "navigating to Concurrency tab");
      const concurrencyTab = screen.getByRole("tab", {
        name: "Concurrency",
      });
      fireEvent.click(concurrencyTab);

      await waitFor(() => {
        const capInput = screen.getByLabelText("OpenAI concurrency cap");
        expect(capInput).toBeDefined();
      });

      const capInput = screen.getByLabelText(
        "OpenAI concurrency cap",
      ) as HTMLInputElement;
      log(8, `current concurrency cap: ${capInput.value}`);

      fireEvent.change(capInput, { target: { value: "2" } });
      fireEvent.blur(capInput);
      log(8, "concurrency cap changed to 2 and saved");

      // Verify storage was updated
      const raw = localStorage.getItem("vucible:v1");
      expect(raw).not.toBeNull();
      let stored: Record<string, unknown> = {};
      try {
        stored = JSON.parse(raw!) as Record<string, unknown>;
      } catch { /* test will fail on next assertion */ }
      expect(
        (stored as { providers?: { openai?: { concurrencyCap?: number } } })
          .providers?.openai?.concurrencyCap,
      ).toBe(2);
      log(8, "verified: localStorage concurrencyCap = 2");

      // ── Step 9: Navigate to History tab → Clear history ──
      log(9, "navigating to History tab");
      const historyTab = screen.getByRole("tab", { name: "History" });
      fireEvent.click(historyTab);

      await waitFor(() => {
        expect(
          screen.getByText("Clear all history"),
        ).toBeDefined();
      });

      log(9, "clicking Clear button");
      const clearBtn = screen.getByRole("button", { name: "Clear" });
      fireEvent.click(clearBtn);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Cleared" }),
        ).toBeDefined();
      });
      log(9, "history cleared — button shows 'Cleared'");

      // Verify IDB is empty
      const { openHistoryDB } = await import("@/lib/storage/history");
      const db = await openHistoryDB();
      const sessionCount = await db
        .transaction("sessions")
        .objectStore("sessions")
        .count();
      const roundCount = await db
        .transaction("rounds")
        .objectStore("rounds")
        .count();
      expect(sessionCount).toBe(0);
      expect(roundCount).toBe(0);
      log(9, `verified: IndexedDB sessions=${sessionCount}, rounds=${roundCount}`);

      log(9, "FULL FLOW COMPLETE");
    },
    30000,
  );
});
