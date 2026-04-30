import { describe, expect, it, vi } from "vitest";
import {
  wizardReducer,
  initialState,
  type WizardState,
  type WizardAction,
} from "./machine";
import type { WizardProgress } from "@/lib/storage/wizard-progress";

function reduce(state: WizardState, ...actions: WizardAction[]): WizardState {
  return actions.reduce(wizardReducer, state);
}

describe("wizardReducer", () => {
  describe("initialState", () => {
    it("returns defaults when progress is null", () => {
      const s = initialState(null);
      expect(s).toEqual({
        step: 1,
        draftProviders: {},
        draftDefaults: {},
        completed: false,
      });
    });

    it("restores from WizardProgress", () => {
      const progress: WizardProgress = {
        step: 3,
        draftProviders: {
          openai: {
            apiKey: "sk-saved",
            tier: "tier2",
            ipm: 20,
            validatedAt: "2025-01-01T00:00:00.000Z",
          },
        },
        draftDefaults: { imageCount: 8 },
      };
      const s = initialState(progress);
      expect(s.step).toBe(3);
      expect(s.draftProviders.openai?.apiKey).toBe("sk-saved");
      expect(s.draftProviders.openai?.tier).toBe("tier2");
      expect(s.draftDefaults).toEqual({ imageCount: 8 });
      expect(s.completed).toBe(false);
    });

    it("defaults draftDefaults to {} when progress omits it", () => {
      const progress: WizardProgress = {
        step: 2,
        draftProviders: {},
      };
      const s = initialState(progress);
      expect(s.draftDefaults).toEqual({});
    });
  });

  describe("set-step", () => {
    it("transitions to the target step", () => {
      const s = reduce(initialState(null), { type: "set-step", step: 3 });
      expect(s.step).toBe(3);
    });

    it("is idempotent for same step", () => {
      const s1 = reduce(initialState(null), { type: "set-step", step: 2 });
      const s2 = reduce(s1, { type: "set-step", step: 2 });
      expect(s2.step).toBe(s1.step);
    });
  });

  describe("set-draft-key", () => {
    it("sets apiKey and clears previous validation fields", () => {
      const withValidation = reduce(
        initialState(null),
        { type: "set-draft-key", provider: "openai", apiKey: "sk-old" },
        { type: "validate-start", provider: "openai" },
        {
          type: "validate-success",
          provider: "openai",
          tier: "tier2",
          ipm: 20,
        },
      );
      expect(withValidation.draftProviders.openai?.tier).toBe("tier2");

      const reset = reduce(withValidation, {
        type: "set-draft-key",
        provider: "openai",
        apiKey: "sk-new",
      });
      expect(reset.draftProviders.openai?.apiKey).toBe("sk-new");
      expect(reset.draftProviders.openai?.tier).toBeUndefined();
      expect(reset.draftProviders.openai?.ipm).toBeUndefined();
      expect(reset.draftProviders.openai?.validatedAt).toBeUndefined();
      expect(reset.draftProviders.openai?.error).toBeUndefined();
    });

    it("does not affect other providers", () => {
      const s = reduce(initialState(null), {
        type: "set-draft-key",
        provider: "openai",
        apiKey: "sk-test",
      });
      expect(s.draftProviders.gemini).toBeUndefined();
    });
  });

  describe("validate-start / validate-success / validate-error flow", () => {
    it("sets validating flag on validate-start", () => {
      const s = reduce(
        initialState(null),
        { type: "set-draft-key", provider: "openai", apiKey: "sk-test" },
        { type: "validate-start", provider: "openai" },
      );
      expect(s.draftProviders.openai?.validating).toBe(true);
      expect(s.draftProviders.openai?.error).toBeUndefined();
    });

    it("clears validating and sets tier/ipm/validatedAt on validate-success", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));

      const s = reduce(
        initialState(null),
        { type: "set-draft-key", provider: "openai", apiKey: "sk-test" },
        { type: "validate-start", provider: "openai" },
        {
          type: "validate-success",
          provider: "openai",
          tier: "tier2",
          ipm: 20,
        },
      );
      const entry = s.draftProviders.openai;
      expect(entry?.validating).toBe(false);
      expect(entry?.tier).toBe("tier2");
      expect(entry?.ipm).toBe(20);
      expect(entry?.validatedAt).toBe("2025-06-15T12:00:00.000Z");
      expect(entry?.error).toBeUndefined();

      vi.useRealTimers();
    });

    it("clears validating and sets error on validate-error", () => {
      const err = { kind: "auth_failed" as const, message: "Invalid API key" };
      const s = reduce(
        initialState(null),
        { type: "set-draft-key", provider: "openai", apiKey: "sk-bad" },
        { type: "validate-start", provider: "openai" },
        { type: "validate-error", provider: "openai", error: err },
      );
      const entry = s.draftProviders.openai;
      expect(entry?.validating).toBe(false);
      expect(entry?.error).toEqual(err);
    });
  });

  describe("set-gemini-mode", () => {
    it("enables gemini by adding an empty entry when none exists", () => {
      const s = reduce(initialState(null), {
        type: "set-gemini-mode",
        enabled: true,
      });
      expect(s.draftProviders.gemini).toEqual({});
    });

    it("preserves existing gemini entry when enabling", () => {
      const withGemini = reduce(initialState(null), {
        type: "set-draft-key",
        provider: "gemini",
        apiKey: "ai-test",
      });
      const s = reduce(withGemini, {
        type: "set-gemini-mode",
        enabled: true,
      });
      expect(s.draftProviders.gemini?.apiKey).toBe("ai-test");
    });

    it("removes gemini entry when disabling", () => {
      const withGemini = reduce(
        initialState(null),
        { type: "set-draft-key", provider: "gemini", apiKey: "ai-test" },
        { type: "set-gemini-mode", enabled: false },
      );
      expect(withGemini.draftProviders.gemini).toBeUndefined();
      expect("gemini" in withGemini.draftProviders).toBe(false);
    });
  });

  describe("set-defaults", () => {
    it("merges partial defaults into draftDefaults", () => {
      const s = reduce(
        initialState(null),
        { type: "set-defaults", defaults: { imageCount: 16 } },
        { type: "set-defaults", defaults: { theme: "dark" } },
      );
      expect(s.draftDefaults).toEqual({ imageCount: 16, theme: "dark" });
    });

    it("overwrites existing fields", () => {
      const s = reduce(
        initialState(null),
        { type: "set-defaults", defaults: { imageCount: 8 } },
        { type: "set-defaults", defaults: { imageCount: 16 } },
      );
      expect(s.draftDefaults.imageCount).toBe(16);
    });
  });

  describe("clear-provider", () => {
    it("removes the provider entry entirely", () => {
      const s = reduce(
        initialState(null),
        { type: "set-draft-key", provider: "openai", apiKey: "sk-test" },
        { type: "clear-provider", provider: "openai" },
      );
      expect(s.draftProviders.openai).toBeUndefined();
      expect("openai" in s.draftProviders).toBe(false);
    });

    it("is a no-op for a provider that does not exist", () => {
      const s = initialState(null);
      const cleared = reduce(s, {
        type: "clear-provider",
        provider: "gemini",
      });
      expect(cleared.draftProviders).toEqual({});
    });
  });

  describe("complete", () => {
    it("sets the completed flag to true", () => {
      const s = reduce(initialState(null), { type: "complete" });
      expect(s.completed).toBe(true);
    });
  });

  describe("full happy path", () => {
    it("walks through all steps, validates, sets defaults, and completes", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));

      const final = reduce(
        initialState(null),
        { type: "set-step", step: 2 },
        { type: "set-draft-key", provider: "openai", apiKey: "sk-live" },
        { type: "validate-start", provider: "openai" },
        {
          type: "validate-success",
          provider: "openai",
          tier: "tier2",
          ipm: 20,
        },
        { type: "set-gemini-mode", enabled: true },
        { type: "set-draft-key", provider: "gemini", apiKey: "ai-live" },
        { type: "validate-start", provider: "gemini" },
        {
          type: "validate-success",
          provider: "gemini",
          tier: "tier1",
          ipm: 5,
        },
        { type: "set-step", step: 3 },
        { type: "set-defaults", defaults: { imageCount: 8 } },
        {
          type: "set-defaults",
          defaults: {
            aspectRatio: { kind: "discrete", ratio: "16:9" },
          },
        },
        { type: "set-step", step: 4 },
        { type: "complete" },
      );

      expect(final.step).toBe(4);
      expect(final.completed).toBe(true);
      expect(final.draftProviders.openai?.tier).toBe("tier2");
      expect(final.draftProviders.openai?.ipm).toBe(20);
      expect(final.draftProviders.gemini?.tier).toBe("tier1");
      expect(final.draftDefaults).toEqual({
        imageCount: 8,
        aspectRatio: { kind: "discrete", ratio: "16:9" },
      });

      vi.useRealTimers();
    });
  });
});
