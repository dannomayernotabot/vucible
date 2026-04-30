import { describe, expect, it } from "vitest";
import {
  wizardReducer,
  initialState,
  type WizardState,
  type WizardAction,
} from "./machine";

function reduce(state: WizardState, ...actions: WizardAction[]): WizardState {
  return actions.reduce(wizardReducer, state);
}

describe("wizardReducer", () => {
  describe("set-step", () => {
    it("transitions to the target step", () => {
      const s = reduce(initialState(), { type: "set-step", step: 3 });
      expect(s.step).toBe(3);
    });

    it("is idempotent", () => {
      const s1 = reduce(initialState(), { type: "set-step", step: 2 });
      const s2 = reduce(s1, { type: "set-step", step: 2 });
      expect(s2).toEqual(s1);
    });
  });

  describe("set-draft-key", () => {
    it("sets provider to editing with apiKey", () => {
      const s = reduce(initialState(), {
        type: "set-draft-key",
        provider: "openai",
        apiKey: "sk-test",
      });
      expect(s.providers.openai).toEqual({
        phase: "editing",
        apiKey: "sk-test",
      });
    });

    it("rejects when provider is validating", () => {
      const editing = reduce(initialState(), {
        type: "set-draft-key",
        provider: "openai",
        apiKey: "sk-test",
      });
      const validating = reduce(editing, {
        type: "validate-start",
        provider: "openai",
      });
      const attempted = reduce(validating, {
        type: "set-draft-key",
        provider: "openai",
        apiKey: "sk-new",
      });
      expect(attempted).toBe(validating);
    });

    it("does not affect other provider", () => {
      const s = reduce(initialState(), {
        type: "set-draft-key",
        provider: "openai",
        apiKey: "sk-test",
      });
      expect(s.providers.gemini).toEqual({ phase: "idle" });
    });
  });

  describe("validate-start", () => {
    it("transitions editing to validating", () => {
      const s = reduce(
        initialState(),
        { type: "set-draft-key", provider: "openai", apiKey: "sk-test" },
        { type: "validate-start", provider: "openai" },
      );
      expect(s.providers.openai).toEqual({
        phase: "validating",
        apiKey: "sk-test",
      });
    });

    it("rejects double-click (already validating)", () => {
      const validating = reduce(
        initialState(),
        { type: "set-draft-key", provider: "openai", apiKey: "sk-test" },
        { type: "validate-start", provider: "openai" },
      );
      const again = reduce(validating, {
        type: "validate-start",
        provider: "openai",
      });
      expect(again).toBe(validating);
    });

    it("rejects from idle state", () => {
      const init = initialState();
      const s = reduce(init, {
        type: "validate-start",
        provider: "openai",
      });
      expect(s).toBe(init);
    });

    it("allows re-validation from error state", () => {
      const errState = reduce(
        initialState(),
        { type: "set-draft-key", provider: "gemini", apiKey: "ai-test" },
        { type: "validate-start", provider: "gemini" },
        {
          type: "validate-error",
          provider: "gemini",
          error: { kind: "auth_failed", message: "bad key" },
        },
      );
      expect(errState.providers.gemini.phase).toBe("error");
      const retrying = reduce(errState, {
        type: "validate-start",
        provider: "gemini",
      });
      expect(retrying.providers.gemini).toEqual({
        phase: "validating",
        apiKey: "ai-test",
      });
    });
  });

  describe("validate-success", () => {
    it("transitions validating to validated with tier and ipm", () => {
      const s = reduce(
        initialState(),
        { type: "set-draft-key", provider: "openai", apiKey: "sk-test" },
        { type: "validate-start", provider: "openai" },
        {
          type: "validate-success",
          provider: "openai",
          tier: "tier2",
          ipm: 20,
        },
      );
      expect(s.providers.openai).toEqual({
        phase: "validated",
        apiKey: "sk-test",
        tier: "tier2",
        ipm: 20,
      });
    });

    it("rejects when not validating", () => {
      const s = reduce(initialState(), {
        type: "validate-success",
        provider: "openai",
        tier: "tier1",
        ipm: 5,
      });
      expect(s.providers.openai.phase).toBe("idle");
    });
  });

  describe("validate-error", () => {
    it("transitions validating to error with NormalizedError", () => {
      const s = reduce(
        initialState(),
        { type: "set-draft-key", provider: "openai", apiKey: "sk-bad" },
        { type: "validate-start", provider: "openai" },
        {
          type: "validate-error",
          provider: "openai",
          error: { kind: "auth_failed", message: "Invalid API key" },
        },
      );
      expect(s.providers.openai).toEqual({
        phase: "error",
        apiKey: "sk-bad",
        error: { kind: "auth_failed", message: "Invalid API key" },
      });
    });

    it("rejects when not validating", () => {
      const s = reduce(initialState(), {
        type: "validate-error",
        provider: "openai",
        error: { kind: "unknown", message: "err" },
      });
      expect(s.providers.openai.phase).toBe("idle");
    });
  });

  describe("set-gemini-tier", () => {
    it("overrides tier on validated gemini", () => {
      const validated = reduce(
        initialState(),
        { type: "set-draft-key", provider: "gemini", apiKey: "ai-test" },
        { type: "validate-start", provider: "gemini" },
        { type: "validate-success", provider: "gemini", tier: "tier1", ipm: 5 },
      );
      const updated = reduce(validated, {
        type: "set-gemini-tier",
        tier: "tier3",
      });
      const gemini = updated.providers.gemini;
      expect(gemini.phase).toBe("validated");
      if (gemini.phase === "validated") {
        expect(gemini.tier).toBe("tier3");
      }
    });

    it("rejects when gemini is not validated", () => {
      const s = reduce(initialState(), {
        type: "set-gemini-tier",
        tier: "tier2",
      });
      expect(s.providers.gemini.phase).toBe("idle");
    });
  });

  describe("clear-provider", () => {
    it("resets provider to idle", () => {
      const s = reduce(
        initialState(),
        { type: "set-draft-key", provider: "openai", apiKey: "sk-test" },
        { type: "validate-start", provider: "openai" },
        {
          type: "validate-success",
          provider: "openai",
          tier: "tier1",
          ipm: 5,
        },
        { type: "clear-provider", provider: "openai" },
      );
      expect(s.providers.openai).toEqual({ phase: "idle" });
    });
  });

  describe("set-image-count", () => {
    it("sets image count", () => {
      const s = reduce(initialState(), {
        type: "set-image-count",
        count: 16,
      });
      expect(s.imageCount).toBe(16);
    });
  });

  describe("set-aspect", () => {
    it("sets aspect ratio", () => {
      const s = reduce(initialState(), {
        type: "set-aspect",
        aspect: { kind: "discrete", ratio: "16:9" },
      });
      expect(s.aspectRatio).toEqual({ kind: "discrete", ratio: "16:9" });
    });
  });

  describe("complete", () => {
    it("returns state unchanged", () => {
      const s = initialState();
      expect(reduce(s, { type: "complete" })).toBe(s);
    });
  });

  describe("full happy path", () => {
    it("walks through all steps and validates both providers", () => {
      const final = reduce(
        initialState(),
        { type: "set-step", step: 2 },
        { type: "set-draft-key", provider: "openai", apiKey: "sk-live" },
        { type: "validate-start", provider: "openai" },
        {
          type: "validate-success",
          provider: "openai",
          tier: "tier2",
          ipm: 20,
        },
        { type: "set-draft-key", provider: "gemini", apiKey: "ai-live" },
        { type: "validate-start", provider: "gemini" },
        {
          type: "validate-success",
          provider: "gemini",
          tier: "tier1",
          ipm: 5,
        },
        { type: "set-step", step: 3 },
        { type: "set-image-count", count: 8 },
        { type: "set-aspect", aspect: { kind: "discrete", ratio: "16:9" } },
        { type: "set-step", step: 4 },
        { type: "complete" },
      );
      expect(final.step).toBe(4);
      expect(final.providers.openai.phase).toBe("validated");
      expect(final.providers.gemini.phase).toBe("validated");
      expect(final.imageCount).toBe(8);
      expect(final.aspectRatio).toEqual({ kind: "discrete", ratio: "16:9" });
    });
  });
});
