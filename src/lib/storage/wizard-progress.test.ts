import { describe, expect, it, beforeEach } from "vitest";
import { getProgress, setProgress, clearProgress } from "./wizard-progress";
import type { WizardProgress } from "./wizard-progress";

const WIZARD_KEY = "vucible:wizard-progress";

function clearWizardStorage() {
  window.localStorage.removeItem(WIZARD_KEY);
}

describe("wizard-progress.ts", () => {
  beforeEach(() => {
    clearWizardStorage();
  });

  describe("round-trip", () => {
    it("setProgress then getProgress returns deep-equal data", () => {
      const p: WizardProgress = {
        step: 1,
        draftProviders: {},
      };
      setProgress(p);
      expect(getProgress()).toEqual(p);
    });

    it("preserves step 1 with empty draftProviders", () => {
      const p: WizardProgress = { step: 1, draftProviders: {} };
      setProgress(p);
      expect(getProgress()).toEqual(p);
    });

    it("preserves step 2 with openai draft", () => {
      const p: WizardProgress = {
        step: 2,
        draftProviders: {
          openai: { apiKey: "sk-test", tier: "tier1", ipm: 10 },
        },
      };
      setProgress(p);
      expect(getProgress()).toEqual(p);
    });

    it("preserves step 3 with both providers and validation error", () => {
      const p: WizardProgress = {
        step: 3,
        draftProviders: {
          openai: { apiKey: "sk-test", validatedAt: "2026-04-30T00:00:00Z" },
          gemini: {
            apiKey: "ai-test",
            error: { kind: "auth_failed", message: "Invalid key" },
          },
        },
      };
      setProgress(p);
      expect(getProgress()).toEqual(p);
    });

    it("preserves step 4 with draftDefaults", () => {
      const p: WizardProgress = {
        step: 4,
        draftProviders: {
          openai: { apiKey: "sk-test", tier: "tier1", ipm: 5, validatedAt: "2026-04-30T00:00:00Z" },
        },
        draftDefaults: {
          imageCount: 8,
          theme: "dark",
        },
      };
      setProgress(p);
      expect(getProgress()).toEqual(p);
    });

    it("preserves draftDefaults with aspect ratio", () => {
      const p: WizardProgress = {
        step: 4,
        draftProviders: {},
        draftDefaults: {
          imageCount: 16,
          aspectRatio: { kind: "discrete", ratio: "16:9" },
          theme: "system",
        },
      };
      setProgress(p);
      expect(getProgress()).toEqual(p);
    });
  });

  describe("malformed input", () => {
    it("returns null for invalid JSON", () => {
      window.localStorage.setItem(WIZARD_KEY, "not json {{{");
      expect(getProgress()).toBeNull();
    });

    it("returns null for non-object JSON", () => {
      window.localStorage.setItem(WIZARD_KEY, '"a string"');
      expect(getProgress()).toBeNull();
    });

    it("returns null for missing step", () => {
      window.localStorage.setItem(WIZARD_KEY, JSON.stringify({ draftProviders: {} }));
      expect(getProgress()).toBeNull();
    });

    it("returns null for step outside 1-4", () => {
      window.localStorage.setItem(WIZARD_KEY, JSON.stringify({ step: 5, draftProviders: {} }));
      expect(getProgress()).toBeNull();
    });

    it("returns null for step 0", () => {
      window.localStorage.setItem(WIZARD_KEY, JSON.stringify({ step: 0, draftProviders: {} }));
      expect(getProgress()).toBeNull();
    });

    it("returns null for non-integer step", () => {
      window.localStorage.setItem(WIZARD_KEY, JSON.stringify({ step: 2.5, draftProviders: {} }));
      expect(getProgress()).toBeNull();
    });
  });

  describe("clearProgress", () => {
    it("removes the wizard key cleanly", () => {
      setProgress({ step: 1, draftProviders: {} });
      expect(getProgress()).not.toBeNull();
      clearProgress();
      expect(getProgress()).toBeNull();
    });

    it("is idempotent on empty storage", () => {
      clearProgress();
      expect(getProgress()).toBeNull();
    });
  });

  describe("isolation from main storage", () => {
    it("does not interfere with vucible:v1 key", () => {
      const mainKey = "vucible:v1";
      window.localStorage.setItem(mainKey, JSON.stringify({ schemaVersion: 1 }));
      setProgress({ step: 2, draftProviders: {} });
      clearProgress();
      expect(window.localStorage.getItem(mainKey)).not.toBeNull();
    });
  });
});
