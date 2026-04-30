import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withRetry, MAX_RETRY_AFTER_MS } from "./retry";
import type { NormalizedError } from "@/lib/providers/errors";

function retryableError(
  overrides?: Partial<NormalizedError>,
): NormalizedError {
  return {
    kind: "rate_limited",
    message: "Too many requests",
    ...overrides,
  };
}

function nonRetryableError(): NormalizedError {
  return { kind: "auth_failed", message: "Invalid key" };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withRetry", () => {
  it("returns the result on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const controller = new AbortController();

    const result = await withRetry(fn, { signal: controller.signal });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries up to 3 attempts on retryable error then throws", async () => {
    const err = retryableError();
    const fn = vi.fn().mockImplementation(async () => {
      throw err;
    });
    const controller = new AbortController();

    const promise = withRetry(fn, { signal: controller.signal });
    promise.catch(() => {});

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws immediately on non-retryable error", async () => {
    const err = nonRetryableError();
    const fn = vi.fn().mockRejectedValue(err);
    const controller = new AbortController();

    await expect(
      withRetry(fn, { signal: controller.signal }),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses Retry-After header when provided", async () => {
    const err = retryableError({ retryAfterSeconds: 5 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("recovered");
    const controller = new AbortController();

    const promise = withRetry(fn, { signal: controller.signal });

    // Should not resolve before 5s
    await vi.advanceTimersByTimeAsync(4000);
    expect(fn).toHaveBeenCalledTimes(1);

    // After 5s total, retry fires
    await vi.advanceTimersByTimeAsync(1500);
    const result = await promise;
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws immediately if Retry-After exceeds MAX_RETRY_AFTER_MS", async () => {
    const err = retryableError({ retryAfterSeconds: 3600 });
    const fn = vi.fn().mockRejectedValue(err);
    const controller = new AbortController();

    await expect(
      withRetry(fn, { signal: controller.signal }),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("propagates AbortError when signal is aborted mid-wait", async () => {
    const err = retryableError();
    const fn = vi.fn().mockRejectedValue(err);
    const controller = new AbortController();

    const promise = withRetry(fn, { signal: controller.signal });

    // Let first attempt fail and start waiting
    await vi.advanceTimersByTimeAsync(100);

    controller.abort();

    await expect(promise).rejects.toSatisfy(
      (e: unknown) => e instanceof DOMException && e.name === "AbortError",
    );
  });

  it("respects maxAttempts override", async () => {
    const err = retryableError();
    const fn = vi.fn().mockRejectedValue(err);
    const controller = new AbortController();

    const promise = withRetry(fn, {
      signal: controller.signal,
      maxAttempts: 1,
    });

    await expect(promise).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("recovers on second attempt after retryable error", async () => {
    const err = retryableError();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("recovered");
    const controller = new AbortController();

    const promise = withRetry(fn, { signal: controller.signal });

    await vi.advanceTimersByTimeAsync(1500);
    const result = await promise;
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("passes the abort signal to fn", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const controller = new AbortController();

    await withRetry(fn, { signal: controller.signal });
    expect(fn).toHaveBeenCalledWith(controller.signal);
  });

  it("re-throws fn error without retrying when signal is already aborted", async () => {
    const err = retryableError();
    const fn = vi.fn().mockRejectedValue(err);
    const controller = new AbortController();
    controller.abort();

    await expect(
      withRetry(fn, { signal: controller.signal }),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("Retry-After at exactly MAX_RETRY_AFTER_MS boundary is accepted", async () => {
    const exactBoundary = MAX_RETRY_AFTER_MS / 1000;
    const err = retryableError({ retryAfterSeconds: exactBoundary });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("ok");
    const controller = new AbortController();

    const promise = withRetry(fn, { signal: controller.signal });

    await vi.advanceTimersByTimeAsync(MAX_RETRY_AFTER_MS + 100);
    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
