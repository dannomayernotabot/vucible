import { describe, expect, it, vi } from "vitest";
import { prepareReferences } from "./prepare-references";
import type { Round, RoundResult } from "@/lib/storage/schema";

function makeSuccess(
  size: number,
  mimeType = "image/png",
): RoundResult & { status: "success" } {
  const bytes = new ArrayBuffer(size);
  const view = new Uint8Array(bytes);
  for (let i = 0; i < size; i++) view[i] = i % 256;
  return {
    status: "success",
    bytes,
    thumbnail: new ArrayBuffer(0),
    mimeType,
    meta: {},
  };
}

function makeRound(
  openaiResults: RoundResult[] = [],
  geminiResults: RoundResult[] = [],
): Round {
  return {
    id: "round-1",
    sessionId: "session-1",
    number: 1,
    promptSent: "test",
    modelsEnabled: { openai: true, gemini: true },
    imageCount: 4,
    aspect: { kind: "discrete", ratio: "1:1" },
    openaiResults,
    geminiResults,
    selections: [],
    commentary: null,
    startedAt: new Date().toISOString(),
    settledAt: new Date().toISOString(),
  };
}

describe("prepareReferences", () => {
  it("produces 4 blobs + 4 base64 strings for 4 selections", () => {
    const round = makeRound(
      [makeSuccess(100), makeSuccess(200)],
      [makeSuccess(300), makeSuccess(400)],
    );
    const result = prepareReferences(round, [
      { provider: "openai", index: 0 },
      { provider: "openai", index: 1 },
      { provider: "gemini", index: 0 },
      { provider: "gemini", index: 1 },
    ]);
    expect(result.blobs).toHaveLength(4);
    expect(result.base64Parts).toHaveLength(4);
  });

  it("preserves mimeType on each Blob", () => {
    const round = makeRound(
      [makeSuccess(10, "image/png")],
      [makeSuccess(10, "image/webp")],
    );
    const result = prepareReferences(round, [
      { provider: "openai", index: 0 },
      { provider: "gemini", index: 0 },
    ]);
    expect(result.blobs[0].type).toBe("image/png");
    expect(result.blobs[1].type).toBe("image/webp");
  });

  it("base64 encodes correctly (round-trips)", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    const round = makeRound([
      {
        status: "success",
        bytes: bytes.buffer as ArrayBuffer,
        thumbnail: new ArrayBuffer(0),
        mimeType: "image/png",
        meta: {},
      },
    ]);
    const result = prepareReferences(round, [
      { provider: "openai", index: 0 },
    ]);
    expect(atob(result.base64Parts[0])).toBe("Hello");
  });

  it("handles 5MB ArrayBuffer without stack overflow", () => {
    const largeResult = makeSuccess(5 * 1024 * 1024);
    const round = makeRound([largeResult]);
    expect(() =>
      prepareReferences(round, [{ provider: "openai", index: 0 }]),
    ).not.toThrow();
    const result = prepareReferences(round, [
      { provider: "openai", index: 0 },
    ]);
    expect(result.base64Parts[0].length).toBeGreaterThan(0);
  });

  it("skips error results", () => {
    const round = makeRound([
      { status: "error", error: { kind: "auth_failed", message: "bad" } },
      makeSuccess(10),
    ]);
    const result = prepareReferences(round, [
      { provider: "openai", index: 0 },
      { provider: "openai", index: 1 },
    ]);
    expect(result.blobs).toHaveLength(1);
    expect(result.base64Parts).toHaveLength(1);
  });

  it("skips loading results", () => {
    const round = makeRound([{ status: "loading" }, makeSuccess(10)]);
    const result = prepareReferences(round, [
      { provider: "openai", index: 0 },
      { provider: "openai", index: 1 },
    ]);
    expect(result.blobs).toHaveLength(1);
  });

  it("warns and skips on missing mimeType", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const round = makeRound([makeSuccess(10, "")]);
    const result = prepareReferences(round, [
      { provider: "openai", index: 0 },
    ]);
    expect(result.blobs).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("missing mimeType"),
    );
    warnSpy.mockRestore();
  });

  it("returns empty for no selections", () => {
    const round = makeRound([makeSuccess(10)]);
    const result = prepareReferences(round, []);
    expect(result.blobs).toHaveLength(0);
    expect(result.base64Parts).toHaveLength(0);
  });

  it("encoding happens once per call (shared object)", () => {
    const round = makeRound([makeSuccess(100)]);
    const selections = [{ provider: "openai" as const, index: 0 }];
    const r1 = prepareReferences(round, selections);
    const r2 = prepareReferences(round, selections);
    expect(r1.base64Parts[0]).toBe(r2.base64Parts[0]);
  });
});
