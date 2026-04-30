import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderThrottle } from "./throttle";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ProviderThrottle", () => {
  it("runs up to cap concurrently", () => {
    const t = new ProviderThrottle(2);
    const d1 = deferred();
    const d2 = deferred();
    const d3 = deferred();

    t.enqueue(() => d1.promise);
    t.enqueue(() => d2.promise);
    t.enqueue(() => d3.promise);

    expect(t.inflight()).toBe(2);
    expect(t.queued()).toBe(1);
  });

  it("drains queue in FIFO order", async () => {
    const t = new ProviderThrottle(1);
    const order: number[] = [];

    const d1 = deferred();
    const d2 = deferred();
    const d3 = deferred();

    t.enqueue(async () => {
      await d1.promise;
      order.push(1);
    });
    t.enqueue(async () => {
      await d2.promise;
      order.push(2);
    });
    t.enqueue(async () => {
      await d3.promise;
      order.push(3);
    });

    expect(t.inflight()).toBe(1);

    d1.resolve();
    await vi.runAllTimersAsync();

    d2.resolve();
    await vi.runAllTimersAsync();

    d3.resolve();
    await vi.runAllTimersAsync();

    expect(order).toEqual([1, 2, 3]);
  });

  it("returns the function's resolved value", async () => {
    const t = new ProviderThrottle(1);
    const result = t.enqueue(async () => 42);

    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe(42);
  });

  it("propagates rejections", async () => {
    const t = new ProviderThrottle(1);
    const result = t.enqueue(async () => {
      throw new Error("boom");
    });

    await expect(result).rejects.toThrow("boom");
  });

  it("setCap higher immediately starts queued items", async () => {
    const t = new ProviderThrottle(1);
    const d1 = deferred();
    const d2 = deferred();
    const d3 = deferred();

    t.enqueue(() => d1.promise);
    t.enqueue(() => d2.promise);
    t.enqueue(() => d3.promise);

    expect(t.inflight()).toBe(1);
    expect(t.queued()).toBe(2);

    t.setCap(3);
    expect(t.inflight()).toBe(3);
    expect(t.queued()).toBe(0);
  });

  it("setCap lower does not preempt running calls", async () => {
    const t = new ProviderThrottle(3);
    const d1 = deferred();
    const d2 = deferred();
    const d3 = deferred();
    const d4 = deferred();

    t.enqueue(() => d1.promise);
    t.enqueue(() => d2.promise);
    t.enqueue(() => d3.promise);
    t.enqueue(() => d4.promise);

    expect(t.inflight()).toBe(3);

    t.setCap(1);
    expect(t.inflight()).toBe(3);

    d1.resolve();
    await vi.runAllTimersAsync();

    // d4 should not start — cap is 1 and 2 still running
    expect(t.inflight()).toBe(2);
    expect(t.queued()).toBe(1);

    d2.resolve();
    await vi.runAllTimersAsync();
    expect(t.inflight()).toBe(1);
    expect(t.queued()).toBe(1);

    d3.resolve();
    await vi.runAllTimersAsync();
    expect(t.inflight()).toBe(1);
    expect(t.queued()).toBe(0);
  });

  it("fires change event on enqueue", () => {
    const t = new ProviderThrottle(2);
    const handler = vi.fn();
    t.addEventListener("change", handler);

    t.enqueue(async () => {});
    expect(handler).toHaveBeenCalled();
  });

  it("fires change event on settle", async () => {
    const t = new ProviderThrottle(1);
    const handler = vi.fn();
    t.addEventListener("change", handler);

    const d = deferred();
    t.enqueue(() => d.promise);

    handler.mockClear();
    d.resolve();
    await vi.runAllTimersAsync();

    expect(handler).toHaveBeenCalled();
  });

  it("fires change event on setCap", () => {
    const t = new ProviderThrottle(1);
    const handler = vi.fn();
    t.addEventListener("change", handler);

    t.setCap(5);
    expect(handler).toHaveBeenCalled();
  });

  describe("seedConsumed", () => {
    it("reserves phantom slots reducing effective cap", () => {
      const t = new ProviderThrottle(2);
      t.seedConsumed(1, 60_000);

      const d1 = deferred();
      const d2 = deferred();
      t.enqueue(() => d1.promise);
      t.enqueue(() => d2.promise);

      expect(t.inflight()).toBe(1);
      expect(t.queued()).toBe(1);
    });

    it("phantom expires after TTL and drains queue", async () => {
      const t = new ProviderThrottle(2);
      t.seedConsumed(1, 60_000);

      const d1 = deferred();
      const d2 = deferred();
      t.enqueue(() => d1.promise);
      t.enqueue(() => d2.promise);

      expect(t.inflight()).toBe(1);

      vi.advanceTimersByTime(60_000);
      await vi.runAllTimersAsync();

      expect(t.inflight()).toBe(2);
      expect(t.queued()).toBe(0);
    });

    it("fires change event on seed and expiry", () => {
      const t = new ProviderThrottle(2);
      const handler = vi.fn();
      t.addEventListener("change", handler);

      t.seedConsumed(1, 60_000);
      expect(handler).toHaveBeenCalledTimes(1);

      handler.mockClear();
      vi.advanceTimersByTime(60_000);
      expect(handler).toHaveBeenCalled();
    });
  });

  it("cap minimum is 1", () => {
    const t = new ProviderThrottle(0);
    const d = deferred();
    t.enqueue(() => d.promise);
    expect(t.inflight()).toBe(1);
  });

  it("setCap minimum is 1", () => {
    const t = new ProviderThrottle(5);
    t.setCap(0);
    const d = deferred();
    t.enqueue(() => d.promise);
    expect(t.inflight()).toBe(1);
  });

  it("handles 5 fns with cap=2 correctly", async () => {
    const t = new ProviderThrottle(2);
    const deferreds = Array.from({ length: 5 }, () => deferred<number>());
    const results: number[] = [];

    const promises = deferreds.map((d, i) =>
      t.enqueue(async () => {
        const v = await d.promise;
        results.push(v);
        return v;
      }),
    );

    expect(t.inflight()).toBe(2);
    expect(t.queued()).toBe(3);

    deferreds[0].resolve(0);
    await vi.runAllTimersAsync();
    expect(t.inflight()).toBe(2);
    expect(t.queued()).toBe(2);

    deferreds[1].resolve(1);
    await vi.runAllTimersAsync();
    expect(t.inflight()).toBe(2);
    expect(t.queued()).toBe(1);

    deferreds[2].resolve(2);
    await vi.runAllTimersAsync();
    expect(t.inflight()).toBe(2);
    expect(t.queued()).toBe(0);

    deferreds[3].resolve(3);
    await vi.runAllTimersAsync();
    expect(t.inflight()).toBe(1);
    expect(t.queued()).toBe(0);

    deferreds[4].resolve(4);
    await vi.runAllTimersAsync();
    expect(t.inflight()).toBe(0);
    expect(t.queued()).toBe(0);

    expect(results).toEqual([0, 1, 2, 3, 4]);
  });
});
