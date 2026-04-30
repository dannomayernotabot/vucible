/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DefaultsPanel } from "./DefaultsPanel";
import { ConcurrencyPanel } from "./ConcurrencyPanel";

const MOCK_STORAGE = {
  schemaVersion: 1,
  providers: {
    openai: {
      apiKey: "sk-test",
      tier: "tier2",
      ipm: 20,
      concurrencyCap: 5,
      validatedAt: new Date().toISOString(),
    },
  },
  defaults: {
    imageCount: 8,
    aspectRatio: { kind: "discrete", ratio: "1:1" },
    theme: "system",
  },
  createdAt: new Date().toISOString(),
};

const mockSetStorage = vi.fn();
let mockStorageData = { ...MOCK_STORAGE };

vi.mock("@/lib/storage/keys", () => ({
  getStorage: () => JSON.parse(JSON.stringify(mockStorageData)),
  setStorage: (...args: unknown[]) => mockSetStorage(...args),
}));

beforeEach(() => {
  mockStorageData = JSON.parse(JSON.stringify(MOCK_STORAGE));
  mockSetStorage.mockClear();
});

afterEach(cleanup);

describe("DefaultsPanel auto-save", () => {
  it("saves image count on click", async () => {
    render(<DefaultsPanel />);

    const btn16 = screen.getByText("16");
    fireEvent.click(btn16);

    await waitFor(() => {
      expect(mockSetStorage).toHaveBeenCalled();
      const saved = mockSetStorage.mock.calls[0][0];
      expect(saved.defaults.imageCount).toBe(16);
    });
  });
});

describe("ConcurrencyPanel auto-save", () => {
  it("clamps value to IPM on blur and writes when different from stored", async () => {
    render(<ConcurrencyPanel />);

    const input = screen.getByLabelText("OpenAI concurrency cap");
    // stored cap is 5, clamped to ipm (20) — different from stored, so write fires
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockSetStorage).toHaveBeenCalled();
      const saved = mockSetStorage.mock.calls[0][0];
      expect(saved.providers.openai.concurrencyCap).toBe(20);
    });
  });

  it("shows warning when value exceeds cap", () => {
    render(<ConcurrencyPanel />);

    const input = screen.getByLabelText("OpenAI concurrency cap");
    fireEvent.change(input, { target: { value: "25" } });

    expect(screen.getByText(/Exceeds your OpenAI rate limit/)).toBeDefined();
  });
});
