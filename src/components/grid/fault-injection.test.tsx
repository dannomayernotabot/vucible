/**
 * @vitest-environment jsdom
 *
 * Cross-validates error-type → UI mapping for all NormalizedError kinds.
 * Verifies: correct message copy, Regenerate button visibility, no Evolve.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ImageCardError } from "./ImageCardError";
import type { ErrorKind, NormalizedError } from "@/lib/providers/errors";

vi.mock("@/lib/round/failures", async () => {
  const actual = await vi.importActual<typeof import("@/lib/round/failures")>(
    "@/lib/round/failures",
  );
  return actual;
});

afterEach(cleanup);

const RETRYABLE_KINDS: ErrorKind[] = ["rate_limited", "server_error", "network_error"];
const NON_RETRYABLE_KINDS: ErrorKind[] = [
  "auth_failed",
  "bad_request",
  "content_blocked",
  "quota_exhausted",
  "unknown",
];

const EXPECTED_MESSAGES: Record<ErrorKind, string | RegExp> = {
  auth_failed: "Invalid API key. Re-check in Settings.",
  rate_limited: /Rate limited/,
  bad_request: "Validation failed. Try again.",
  content_blocked: "Content blocked by safety filter.",
  server_error: "Provider error. Try again.",
  network_error: "Network error.",
  quota_exhausted: "Quota exhausted. Add billing or wait for reset.",
  unknown: "Unexpected error. Try again.",
};

function makeError(kind: ErrorKind, message = "test"): NormalizedError {
  return { kind, message };
}

describe("Fault injection: all error kinds", () => {
  for (const kind of [...RETRYABLE_KINDS, ...NON_RETRYABLE_KINDS]) {
    it(`${kind}: renders correct message`, () => {
      render(<ImageCardError error={makeError(kind)} onRegenerate={() => {}} />);
      const expected = EXPECTED_MESSAGES[kind];
      if (typeof expected === "string") {
        expect(screen.getByText(expected)).toBeDefined();
      } else {
        expect(screen.getByText(expected)).toBeDefined();
      }
    });
  }

  for (const kind of RETRYABLE_KINDS) {
    it(`${kind}: shows Regenerate button`, () => {
      const onRegenerate = vi.fn();
      render(<ImageCardError error={makeError(kind)} onRegenerate={onRegenerate} />);
      const btn = screen.getByRole("button", { name: "Regenerate" });
      expect(btn).toBeDefined();
      fireEvent.click(btn);
      expect(onRegenerate).toHaveBeenCalledOnce();
    });
  }

  for (const kind of NON_RETRYABLE_KINDS) {
    it(`${kind}: hides Regenerate button`, () => {
      render(<ImageCardError error={makeError(kind)} onRegenerate={() => {}} />);
      expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
    });
  }

  it("rate_limited with retryAfterSeconds: includes wait time in message", () => {
    const err: NormalizedError = {
      kind: "rate_limited",
      message: "429",
      retryAfterSeconds: 30,
    };
    render(<ImageCardError error={err} />);
    expect(screen.getByText(/Wait 30s/)).toBeDefined();
  });

  it("network_error DNS: shows DNS-specific copy", () => {
    const err: NormalizedError = {
      kind: "network_error",
      message: "getaddrinfo ENOTFOUND api.openai.com dns resolve failed",
    };
    render(<ImageCardError error={err} />);
    expect(screen.getByText("DNS resolution failed.")).toBeDefined();
  });

  it("network_error timeout: shows timeout-specific copy", () => {
    const err: NormalizedError = {
      kind: "network_error",
      message: "request timed out after 30s",
    };
    render(<ImageCardError error={err} />);
    expect(screen.getByText("Request timed out.")).toBeDefined();
  });

  it("network_error abort: shows abort copy", () => {
    const err: NormalizedError = {
      kind: "network_error",
      message: "The operation was aborted",
    };
    render(<ImageCardError error={err} />);
    expect(screen.getByText("Request aborted.")).toBeDefined();
  });

  it("all error tiles use alert role", () => {
    for (const kind of [...RETRYABLE_KINDS, ...NON_RETRYABLE_KINDS]) {
      const { unmount } = render(
        <ImageCardError error={makeError(kind)} />,
      );
      expect(screen.getByRole("alert")).toBeDefined();
      unmount();
    }
  });

  it("no Evolve button in error tiles", () => {
    for (const kind of [...RETRYABLE_KINDS, ...NON_RETRYABLE_KINDS]) {
      const { unmount } = render(
        <ImageCardError error={makeError(kind)} />,
      );
      expect(screen.queryByText("Evolve")).toBeNull();
      unmount();
    }
  });
});
