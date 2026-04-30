/**
 * @vitest-environment jsdom
 *
 * Cross-validates the full error pipeline:
 *   msw HTTP response → real provider function → NormalizedError → real errorToMessage → ImageCardError UI
 *
 * Also tests RateLimitBanner threshold and dismiss behavior.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../../vitest.setup";
import { generate as openaiGenerate } from "@/lib/providers/openai";
import { generate as geminiGenerate } from "@/lib/providers/gemini";
import { ImageCardError } from "./ImageCardError";
import { RateLimitBanner } from "@/components/feedback/RateLimitBanner";
import type { ErrorKind, NormalizedError } from "@/lib/providers/errors";

const OPENAI_GEN = "https://api.openai.com/v1/images/generations";
const GEMINI_GEN = "https://generativelanguage.googleapis.com/v1beta/models/*";

const openaiArgs = { prompt: "test", size: { width: 1024, height: 1024 } } as const;
const geminiArgs = { prompt: "test", aspectRatio: "1:1" as const } as const;

vi.mock("@/lib/round/failures", async () => {
  const actual = await vi.importActual<typeof import("@/lib/round/failures")>(
    "@/lib/round/failures",
  );
  return actual;
});

let mock429: Record<string, number> = { openai: 0, gemini: 0 };
vi.mock("@/components/round/RoundProvider", () => ({
  useRound: () => ({ consecutive429Count: mock429 }),
}));

afterEach(() => {
  cleanup();
  mock429 = { openai: 0, gemini: 0 };
});

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

async function openaiErr(status: number, body: unknown, headers?: Record<string, string>): Promise<NormalizedError> {
  server.use(http.post(OPENAI_GEN, () => HttpResponse.json(body, { status, headers })));
  const r = await openaiGenerate("sk-test", openaiArgs);
  if (r.ok) throw new Error("expected error");
  return r.error;
}

async function geminiErr(status: number, body: unknown): Promise<NormalizedError> {
  server.use(http.post(GEMINI_GEN, () => HttpResponse.json(body, { status })));
  const r = await geminiGenerate("AIza-test", geminiArgs);
  if (r.ok) throw new Error("expected error");
  return r.error;
}

describe("msw → OpenAI provider → UI", () => {
  it("401 → auth_failed tile, correct message, no Regenerate", async () => {
    const err = await openaiErr(401, { error: { message: "Invalid API key" } });
    expect(err.kind).toBe("auth_failed");
    render(<ImageCardError error={err} onRegenerate={vi.fn()} />);
    expect(screen.getByText(/Invalid API key/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
  });

  it("429 → rate_limited tile with Regenerate", async () => {
    const err = await openaiErr(429, { error: { message: "Too many requests" } });
    expect(err.kind).toBe("rate_limited");
    render(<ImageCardError error={err} onRegenerate={vi.fn()} />);
    expect(screen.getByText(/Rate limited/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeDefined();
  });

  it("429 with retry-after header → message includes wait seconds", async () => {
    const err = await openaiErr(429, { error: { message: "Rate limited" } }, { "retry-after": "30" });
    expect(err.retryAfterSeconds).toBe(30);
    render(<ImageCardError error={err} />);
    expect(screen.getByText(/30s/)).toBeDefined();
  });

  it("400 content_policy_violation → content_blocked, no Regenerate", async () => {
    const err = await openaiErr(400, {
      error: { message: "Content violates policy", code: "content_policy_violation" },
    });
    expect(err.kind).toBe("content_blocked");
    render(<ImageCardError error={err} onRegenerate={vi.fn()} />);
    expect(screen.getByText(/Content blocked/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
  });

  it("402 → quota_exhausted, no Regenerate", async () => {
    const err = await openaiErr(402, { error: { message: "Insufficient funds" } });
    expect(err.kind).toBe("quota_exhausted");
    render(<ImageCardError error={err} onRegenerate={vi.fn()} />);
    expect(screen.getByText(/Quota exhausted/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
  });

  it("500 → server_error with Regenerate", async () => {
    const err = await openaiErr(500, { error: { message: "Internal server error" } });
    expect(err.kind).toBe("server_error");
    render(<ImageCardError error={err} onRegenerate={vi.fn()} />);
    expect(screen.getByText(/Provider error/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeDefined();
  });

  it("network drop → network_error with Regenerate", async () => {
    server.use(http.post(OPENAI_GEN, () => HttpResponse.error()));
    const r = await openaiGenerate("sk-test", openaiArgs);
    if (r.ok) throw new Error("expected error");
    expect(r.error.kind).toBe("network_error");
    render(<ImageCardError error={r.error} onRegenerate={vi.fn()} />);
    expect(screen.getByText(/Network error/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeDefined();
  });
});

describe("msw → Gemini provider → UI", () => {
  it("403 → auth_failed, no Regenerate", async () => {
    const err = await geminiErr(403, {
      error: { message: "API key not valid", status: "PERMISSION_DENIED" },
    });
    expect(err.kind).toBe("auth_failed");
    render(<ImageCardError error={err} onRegenerate={vi.fn()} />);
    expect(screen.getByText(/Invalid API key/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
  });

  it("429 RESOURCE_EXHAUSTED + quota → quota_exhausted", async () => {
    const err = await geminiErr(429, {
      error: { message: "Quota exceeded for GenerateContent", status: "RESOURCE_EXHAUSTED" },
    });
    expect(err.kind).toBe("quota_exhausted");
    render(<ImageCardError error={err} onRegenerate={vi.fn()} />);
    expect(screen.getByText(/Quota exhausted/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
  });

  it("429 non-quota → rate_limited with Regenerate", async () => {
    const err = await geminiErr(429, {
      error: { message: "Too many requests", status: "RESOURCE_EXHAUSTED" },
    });
    expect(err.kind).toBe("rate_limited");
    render(<ImageCardError error={err} onRegenerate={vi.fn()} />);
    expect(screen.getByText(/Rate limited/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeDefined();
  });

  it("400 safety block → content_blocked", async () => {
    const err = await geminiErr(400, {
      error: { message: "Image blocked by safety settings", status: "INVALID_ARGUMENT" },
    });
    expect(err.kind).toBe("content_blocked");
    render(<ImageCardError error={err} onRegenerate={vi.fn()} />);
    expect(screen.getByText(/Content blocked/)).toBeDefined();
  });

  it("500 → server_error with Regenerate", async () => {
    const err = await geminiErr(500, {
      error: { message: "Internal error", status: "INTERNAL" },
    });
    expect(err.kind).toBe("server_error");
    render(<ImageCardError error={err} onRegenerate={vi.fn()} />);
    expect(screen.getByText(/Provider error/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeDefined();
  });

  it("network drop → network_error", async () => {
    server.use(http.post(GEMINI_GEN, () => HttpResponse.error()));
    const r = await geminiGenerate("AIza-test", geminiArgs);
    if (r.ok) throw new Error("expected error");
    expect(r.error.kind).toBe("network_error");
    render(<ImageCardError error={r.error} onRegenerate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeDefined();
  });

  it("abort → network_error with abort copy", async () => {
    const controller = new AbortController();
    controller.abort();
    const r = await geminiGenerate("AIza-test", { ...geminiArgs, signal: controller.signal });
    if (r.ok) throw new Error("expected error");
    expect(r.error.kind).toBe("network_error");
    render(<ImageCardError error={r.error} />);
    expect(screen.getByText(/aborted/i)).toBeDefined();
  });
});

describe("RateLimitBanner threshold and dismiss", () => {
  it("hidden when consecutive429Count below threshold (< 3)", () => {
    mock429 = { openai: 2, gemini: 0 };
    render(<RateLimitBanner />);
    expect(screen.queryByText(/rate limit/i)).toBeNull();
  });

  it("shows OpenAI banner at threshold", () => {
    mock429 = { openai: 3, gemini: 0 };
    render(<RateLimitBanner />);
    expect(screen.getByText(/OpenAI rate limit/)).toBeDefined();
    expect(screen.queryByText(/Gemini rate limit/)).toBeNull();
  });

  it("shows Gemini banner at threshold", () => {
    mock429 = { openai: 0, gemini: 3 };
    render(<RateLimitBanner />);
    expect(screen.getByText(/Gemini rate limit/)).toBeDefined();
    expect(screen.queryByText(/OpenAI rate limit/)).toBeNull();
  });

  it("shows both banners when both providers hit threshold", () => {
    mock429 = { openai: 5, gemini: 4 };
    render(<RateLimitBanner />);
    expect(screen.getByText(/OpenAI rate limit/)).toBeDefined();
    expect(screen.getByText(/Gemini rate limit/)).toBeDefined();
  });

  it("dismiss button hides individual provider banner", () => {
    mock429 = { openai: 3, gemini: 3 };
    render(<RateLimitBanner />);
    expect(screen.getAllByLabelText(/Dismiss/)).toHaveLength(2);

    fireEvent.click(screen.getByLabelText("Dismiss openai rate limit warning"));
    expect(screen.queryByText(/OpenAI rate limit/)).toBeNull();
    expect(screen.getByText(/Gemini rate limit/)).toBeDefined();
  });
});
