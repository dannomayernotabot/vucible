import { describe, expect, it } from "vitest";
import { isPlausibleOpenAIKey, isPlausibleGeminiKey } from "./validation";

describe("isPlausibleOpenAIKey", () => {
  it("accepts valid-looking key", () => {
    expect(isPlausibleOpenAIKey("sk-proj-abc123def456ghi789jklmnop")).toBe(true);
  });

  it("accepts key with leading/trailing whitespace (trimmed)", () => {
    expect(isPlausibleOpenAIKey("  sk-proj-abc123def456ghi789jklmnop  ")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isPlausibleOpenAIKey("")).toBe(false);
  });

  it("rejects whitespace-only", () => {
    expect(isPlausibleOpenAIKey("   ")).toBe(false);
  });

  it("rejects wrong prefix (Gemini key)", () => {
    expect(isPlausibleOpenAIKey("AIzaSyAbc123def456ghi789jklmnop")).toBe(false);
  });

  it("rejects too-short key", () => {
    expect(isPlausibleOpenAIKey("sk-short")).toBe(false);
  });

  it("rejects case-insensitive prefix (SK-)", () => {
    expect(isPlausibleOpenAIKey("SK-proj-abc123def456ghi789jklmnop")).toBe(false);
  });
});

describe("isPlausibleGeminiKey", () => {
  it("accepts valid-looking key", () => {
    expect(isPlausibleGeminiKey("AIzaSyAbc123def456ghi789jklmnop")).toBe(true);
  });

  it("accepts key with leading/trailing whitespace (trimmed)", () => {
    expect(isPlausibleGeminiKey("  AIzaSyAbc123def456ghi789jklmnop  ")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isPlausibleGeminiKey("")).toBe(false);
  });

  it("rejects whitespace-only", () => {
    expect(isPlausibleGeminiKey("   ")).toBe(false);
  });

  it("rejects wrong prefix (OpenAI key)", () => {
    expect(isPlausibleGeminiKey("sk-proj-abc123def456ghi789jklmnop")).toBe(false);
  });

  it("rejects too-short key", () => {
    expect(isPlausibleGeminiKey("AIza-short")).toBe(false);
  });

  it("rejects lowercase prefix (aiza)", () => {
    expect(isPlausibleGeminiKey("aizaSyAbc123def456ghi789jklmnop")).toBe(false);
  });
});
