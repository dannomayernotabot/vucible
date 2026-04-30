/**
 * DD-019 copy verification: ImageCardError displays the correct message
 * and Regenerate button visibility for each ErrorKind.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ImageCardError } from "./ImageCardError";
import type { NormalizedError, ErrorKind } from "@/lib/providers/errors";

afterEach(cleanup);

interface CopyTestCase {
  kind: ErrorKind;
  message: string;
  retryAfterSeconds?: number;
  expectedCopy: string;
  regenerateVisible: boolean;
}

const COPY_MATRIX: CopyTestCase[] = [
  {
    kind: "auth_failed",
    message: "Unauthorized",
    expectedCopy: "Invalid API key. Re-check in Settings.",
    regenerateVisible: false,
  },
  {
    kind: "rate_limited",
    message: "Too many requests",
    retryAfterSeconds: 30,
    expectedCopy: "Rate limited. Wait 30s and retry.",
    regenerateVisible: true,
  },
  {
    kind: "rate_limited",
    message: "Too many requests",
    expectedCopy: "Rate limited. Wait a moment and retry.",
    regenerateVisible: true,
  },
  {
    kind: "bad_request",
    message: "Invalid input",
    expectedCopy: "Validation failed. Try again.",
    regenerateVisible: false,
  },
  {
    kind: "content_blocked",
    message: "Safety filter",
    expectedCopy: "Content blocked by safety filter.",
    regenerateVisible: false,
  },
  {
    kind: "server_error",
    message: "Internal server error",
    expectedCopy: "Provider error. Try again.",
    regenerateVisible: true,
  },
  {
    kind: "network_error",
    message: "Request timed out",
    expectedCopy: "Request timed out.",
    regenerateVisible: true,
  },
  {
    kind: "network_error",
    message: "DNS resolution failed",
    expectedCopy: "DNS resolution failed.",
    regenerateVisible: true,
  },
  {
    kind: "network_error",
    message: "Request aborted",
    expectedCopy: "Request aborted.",
    regenerateVisible: true,
  },
  {
    kind: "network_error",
    message: "Something went wrong",
    expectedCopy: "Network error.",
    regenerateVisible: true,
  },
  {
    kind: "quota_exhausted",
    message: "Quota exceeded",
    expectedCopy: "Quota exhausted. Add billing or wait for reset.",
    regenerateVisible: false,
  },
  {
    kind: "unknown",
    message: "Something broke",
    expectedCopy: "Unexpected error. Try again.",
    regenerateVisible: false,
  },
];

describe("ImageCardError DD-019 copy matrix", () => {
  for (const tc of COPY_MATRIX) {
    const label = tc.retryAfterSeconds
      ? `${tc.kind} (retryAfter=${tc.retryAfterSeconds}s)`
      : tc.kind;

    it(`${label} → "${tc.expectedCopy}" (Regenerate: ${tc.regenerateVisible})`, () => {
      const error: NormalizedError = {
        kind: tc.kind,
        message: tc.message,
        ...(tc.retryAfterSeconds !== undefined && {
          retryAfterSeconds: tc.retryAfterSeconds,
        }),
      };

      render(
        <ImageCardError error={error} onRegenerate={() => {}} />,
      );

      expect(screen.getByText(tc.expectedCopy)).toBeDefined();

      const btn = screen.queryByRole("button", { name: "Regenerate" });
      if (tc.regenerateVisible) {
        expect(btn).not.toBeNull();
      } else {
        expect(btn).toBeNull();
      }
    });
  }
});
