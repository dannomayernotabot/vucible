import { describe, expect, it, beforeEach } from "vitest";
import { getStorage, setStorage, clearStorage, getEnabledProviderEntries, getOpenaiModel, setOpenaiModel } from "./keys";
import { STORAGE_KEY } from "./schema";
import type { VucibleStorageV1, ProviderConfig } from "@/lib/providers/types";

function clearLocalStorage() {
  window.localStorage.removeItem(STORAGE_KEY);
}

const GEMINI_CONFIG: ProviderConfig = {
  apiKey: "test-gemini-key",
  tier: "tier1",
  ipm: 10,
  concurrencyCap: 5,
  validatedAt: "2026-04-30T00:00:00Z",
};

const OPENAI_CONFIG: ProviderConfig = {
  apiKey: "test-openai-key",
  tier: "tier1",
  ipm: 5,
  concurrencyCap: 5,
  validatedAt: "2026-04-30T00:00:00Z",
};

function makeStorage(overrides?: Partial<VucibleStorageV1>): VucibleStorageV1 {
  return {
    schemaVersion: 1,
    providers: { openai: OPENAI_CONFIG },
    defaults: {
      imageCount: 8,
      aspectRatio: { kind: "discrete", ratio: "1:1" },
      theme: "dark",
    },
    createdAt: "2026-04-30T00:00:00Z",
    ...overrides,
  };
}

describe("keys.ts", () => {
  beforeEach(() => {
    clearLocalStorage();
  });

  describe("round-trip", () => {
    it("setStorage then getStorage returns deep-equal data", () => {
      const s = makeStorage();
      setStorage(s);
      const loaded = getStorage();
      expect(loaded).toEqual(s);
    });

    it("preserves all provider configs", () => {
      const s = makeStorage({
        providers: { openai: OPENAI_CONFIG, gemini: GEMINI_CONFIG },
      });
      setStorage(s);
      const loaded = getStorage();
      expect(loaded!.providers.openai).toEqual(OPENAI_CONFIG);
      expect(loaded!.providers.gemini).toEqual(GEMINI_CONFIG);
    });
  });

  describe("aspect snap on write", () => {
    it("snaps freeform to discrete when Gemini is configured", () => {
      const s = makeStorage({
        providers: { openai: OPENAI_CONFIG, gemini: GEMINI_CONFIG },
        defaults: {
          imageCount: 8,
          aspectRatio: { kind: "freeform", width: 100, height: 100 },
          theme: "dark",
        },
      });
      setStorage(s);
      const loaded = getStorage();
      expect(loaded!.defaults.aspectRatio).toEqual({
        kind: "discrete",
        ratio: "1:1",
      });
    });

    it("leaves freeform unchanged when only OpenAI is configured", () => {
      const s = makeStorage({
        providers: { openai: OPENAI_CONFIG },
        defaults: {
          imageCount: 8,
          aspectRatio: { kind: "freeform", width: 1280, height: 720 },
          theme: "dark",
        },
      });
      setStorage(s);
      const loaded = getStorage();
      expect(loaded!.defaults.aspectRatio).toEqual({
        kind: "freeform",
        width: 1280,
        height: 720,
      });
    });

    it("snaps freeform 5:2 to 21:9 when Gemini configured", () => {
      const s = makeStorage({
        providers: { openai: OPENAI_CONFIG, gemini: GEMINI_CONFIG },
        defaults: {
          imageCount: 8,
          aspectRatio: { kind: "freeform", width: 500, height: 200 },
          theme: "dark",
        },
      });
      setStorage(s);
      const loaded = getStorage();
      expect(loaded!.defaults.aspectRatio).toEqual({
        kind: "discrete",
        ratio: "21:9",
      });
    });

    it("leaves discrete unchanged regardless of providers", () => {
      const s = makeStorage({
        providers: { gemini: GEMINI_CONFIG },
        defaults: {
          imageCount: 4,
          aspectRatio: { kind: "discrete", ratio: "16:9" },
          theme: "system",
        },
      });
      setStorage(s);
      const loaded = getStorage();
      expect(loaded!.defaults.aspectRatio).toEqual({
        kind: "discrete",
        ratio: "16:9",
      });
    });
  });

  describe("missing key", () => {
    it("returns null when key was never set", () => {
      expect(getStorage()).toBeNull();
    });
  });

  describe("malformed input", () => {
    it("returns null for invalid JSON", () => {
      window.localStorage.setItem(STORAGE_KEY, "not json {{{");
      expect(getStorage()).toBeNull();
    });

    it("returns null for non-object JSON", () => {
      window.localStorage.setItem(STORAGE_KEY, '"a string"');
      expect(getStorage()).toBeNull();
    });

    it("returns null for missing schemaVersion", () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }));
      expect(getStorage()).toBeNull();
    });
  });

  describe("clearStorage", () => {
    it("clears then getStorage returns null", () => {
      setStorage(makeStorage());
      expect(getStorage()).not.toBeNull();
      clearStorage();
      expect(getStorage()).toBeNull();
    });
  });

  describe("getEnabledProviderEntries", () => {
    it("returns both providers when both configured", () => {
      const s = makeStorage({
        providers: { openai: OPENAI_CONFIG, gemini: GEMINI_CONFIG },
      });
      const entries = getEnabledProviderEntries(s);
      expect(entries).toHaveLength(2);
      expect(entries[0][0]).toBe("openai");
      expect(entries[1][0]).toBe("gemini");
    });

    it("returns only configured providers", () => {
      const s = makeStorage({ providers: { gemini: GEMINI_CONFIG } });
      const entries = getEnabledProviderEntries(s);
      expect(entries).toHaveLength(1);
      expect(entries[0][0]).toBe("gemini");
      expect(entries[0][1]).toEqual(GEMINI_CONFIG);
    });

    it("returns empty array when no providers configured", () => {
      const s = makeStorage({ providers: {} });
      expect(getEnabledProviderEntries(s)).toEqual([]);
    });
  });

  describe("getOpenaiModel / setOpenaiModel", () => {
    it("returns default gpt-image-1 when no storage", () => {
      expect(getOpenaiModel()).toBe("gpt-image-1");
    });

    it("returns default gpt-image-1 when openaiModel not set", () => {
      setStorage(makeStorage());
      expect(getOpenaiModel()).toBe("gpt-image-1");
    });

    it("round-trips a custom model name", () => {
      setStorage(makeStorage());
      setOpenaiModel("dall-e-3");
      expect(getOpenaiModel()).toBe("dall-e-3");
    });

    it("preserves other storage fields on setOpenaiModel", () => {
      const s = makeStorage();
      setStorage(s);
      setOpenaiModel("dall-e-3");
      const loaded = getStorage();
      expect(loaded!.providers).toEqual(s.providers);
      expect(loaded!.defaults).toEqual(s.defaults);
      expect(loaded!.openaiModel).toBe("dall-e-3");
    });

    it("no-ops when storage is empty", () => {
      setOpenaiModel("dall-e-3");
      expect(getStorage()).toBeNull();
    });
  });
});
