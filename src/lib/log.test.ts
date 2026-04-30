import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { logEvent, redact } from "./log";
import type { ErrorKind } from "@/lib/providers/errors";

function parseJsonSafe(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`Expected valid JSON but got: ${String(e)}\nInput: ${s}`);
  }
}

describe("redact", () => {
  it("strips apiKey", () => {
    const result = redact({ apiKey: "test-value", roundId: "r1" });
    expect(result).not.toHaveProperty("apiKey");
    expect(result).toHaveProperty("roundId", "r1");
  });

  it("strips key", () => {
    const result = redact({ key: "test-value", provider: "openai" });
    expect(result).not.toHaveProperty("key");
    expect(result).toHaveProperty("provider", "openai");
  });

  it("strips authorization", () => {
    const result = redact({ authorization: "Bearer test-value" });
    expect(result).not.toHaveProperty("authorization");
  });

  it("passes through clean objects unchanged", () => {
    const result = redact({ roundId: "r1", ms: 42, provider: "gemini" });
    expect(result).toEqual({ roundId: "r1", ms: 42, provider: "gemini" });
  });
});

describe("logEvent", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("all 8 ErrorKind values produce a single-line parseable JSON payload", () => {
    const spy = vi.spyOn(console, "error");
    const errorKinds: ErrorKind[] = [
      "auth_failed",
      "rate_limited",
      "bad_request",
      "content_blocked",
      "server_error",
      "network_error",
      "quota_exhausted",
      "unknown",
    ];
    for (const errorKind of errorKinds) {
      spy.mockClear();
      logEvent({ event: "round.slot.error", level: "error", errorKind });
      const line = spy.mock.calls[0][0] as string;
      expect(line).not.toContain("\n");
      const jsonPart = line.slice(line.indexOf(" ") + 1);
      const parsed = parseJsonSafe(jsonPart);
      expect(parsed.errorKind).toBe(errorKind);
    }
  });

  it("routes level:error to console.error", () => {
    const spy = vi.spyOn(console, "error");
    logEvent({ event: "round.slot.error", level: "error", errorKind: "auth_failed" });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toMatch(/^vucible\[round\.slot\.error\] /);
  });

  it("routes level:warn to console.warn", () => {
    const spy = vi.spyOn(console, "warn");
    logEvent({ event: "cache.overflow.warn", level: "warn" });
    expect(spy).toHaveBeenCalledOnce();
  });

  it("routes level:debug to console.debug", () => {
    const spy = vi.spyOn(console, "debug");
    logEvent({ event: "round.start", level: "debug", roundId: "r1" });
    expect(spy).toHaveBeenCalledOnce();
  });

  it("defaults to console.log when level is omitted (info)", () => {
    const spy = vi.spyOn(console, "log");
    logEvent({ event: "round.settle", roundId: "r1", ms: 42 });
    expect(spy).toHaveBeenCalledOnce();
  });

  it("formats output as vucible[event] {json}", () => {
    const spy = vi.spyOn(console, "log");
    logEvent({ event: "round.start", roundId: "r42", provider: "gemini" });
    const line = spy.mock.calls[0][0] as string;
    expect(line).toMatch(/^vucible\[round\.start\] /);
    const jsonPart = line.slice(line.indexOf(" ") + 1);
    const parsed = parseJsonSafe(jsonPart);
    expect(parsed.roundId).toBe("r42");
    expect(parsed.provider).toBe("gemini");
  });

  it("redacts protected fields before logging", () => {
    const spy = vi.spyOn(console, "log");
    logEvent({ event: "storage.write", apiKey: "test-value" });
    const line = spy.mock.calls[0][0] as string;
    expect(line).not.toContain("test-value");
    expect(line).not.toContain("apiKey");
  });
});
