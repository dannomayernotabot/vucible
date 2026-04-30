import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { seedFromWizard } from "./seed";
import { ProviderThrottle } from "./throttle";
import type { VucibleStorageV1 } from "@/lib/providers/types";

function makeStorage(validatedAt: string | undefined): VucibleStorageV1 {
  return {
    schemaVersion: 1,
    providers: {
      openai: validatedAt
        ? {
            apiKey: "sk-test",
            tier: "tier1",
            ipm: 5,
            concurrencyCap: 5,
            validatedAt,
          }
        : undefined,
    },
    defaults: {
      imageCount: 8,
      aspectRatio: { kind: "discrete", ratio: "1:1" },
      theme: "system",
    },
    createdAt: new Date().toISOString(),
  } as unknown as VucibleStorageV1;
}

describe("seedFromWizard", () => {
  let throttle: ProviderThrottle;

  beforeEach(() => {
    vi.useFakeTimers();
    throttle = new ProviderThrottle(5);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("seeds throttle when validatedAt is within window", () => {
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    const spy = vi.spyOn(throttle, "seedConsumed");

    seedFromWizard(makeStorage(tenSecondsAgo), { openai: throttle });

    expect(spy).toHaveBeenCalledOnce();
    const ttl = spy.mock.calls[0][1];
    expect(ttl).toBeGreaterThan(49_000);
    expect(ttl).toBeLessThanOrEqual(50_000);
  });

  it("does not seed when validatedAt is expired", () => {
    const twoMinutesAgo = new Date(Date.now() - 120_000).toISOString();
    const spy = vi.spyOn(throttle, "seedConsumed");

    seedFromWizard(makeStorage(twoMinutesAgo), { openai: throttle });

    expect(spy).not.toHaveBeenCalled();
  });

  it("does not seed when no openai provider", () => {
    const spy = vi.spyOn(throttle, "seedConsumed");
    seedFromWizard(makeStorage(undefined), { openai: throttle });
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not seed when no throttle provided", () => {
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    seedFromWizard(makeStorage(tenSecondsAgo), {});
  });
});
