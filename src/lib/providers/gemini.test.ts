import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../vitest.setup";
import { listModels, generate, mapError } from "./gemini";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB" +
  "Nl7BcQAAAABJRU5ErkJggg==";

function geminiSuccessBody(mimeType = "image/png", b64 = TINY_PNG_B64) {
  return {
    candidates: [
      {
        content: {
          parts: [
            { text: "Here is your image:" },
            { inline_data: { mime_type: mimeType, data: b64 } },
          ],
        },
      },
    ],
  };
}

describe("mapError", () => {
  it("maps 401 to auth_failed", () => {
    const err = mapError(401, { error: { message: "bad key", status: "UNAUTHENTICATED" } });
    expect(err.kind).toBe("auth_failed");
    expect(err.httpStatus).toBe(401);
  });

  it("maps 403 to auth_failed", () => {
    const err = mapError(403, { error: { message: "forbidden" } });
    expect(err.kind).toBe("auth_failed");
  });

  it("maps 429 to rate_limited", () => {
    const err = mapError(429, { error: { message: "too many requests", status: "RESOURCE_EXHAUSTED" } });
    expect(err.kind).toBe("rate_limited");
  });

  it("maps 429 quota to quota_exhausted", () => {
    const err = mapError(429, {
      error: { message: "Quota exceeded for project", status: "RESOURCE_EXHAUSTED" },
    });
    expect(err.kind).toBe("quota_exhausted");
  });

  it("maps 400 INVALID_ARGUMENT to bad_request", () => {
    const err = mapError(400, {
      error: { message: "invalid param", status: "INVALID_ARGUMENT" },
    });
    expect(err.kind).toBe("bad_request");
  });

  it("maps 400 INVALID_ARGUMENT with safety to content_blocked", () => {
    const err = mapError(400, {
      error: { message: "Blocked by safety filter", status: "INVALID_ARGUMENT" },
    });
    expect(err.kind).toBe("content_blocked");
  });

  it("maps 500 to server_error", () => {
    const err = mapError(500, { error: { message: "internal" } });
    expect(err.kind).toBe("server_error");
  });

  it("maps 503 to server_error", () => {
    const err = mapError(503, {});
    expect(err.kind).toBe("server_error");
  });

  it("maps unknown status to unknown", () => {
    const err = mapError(418, {});
    expect(err.kind).toBe("unknown");
  });

  it("handles null body gracefully", () => {
    const err = mapError(500, null);
    expect(err.kind).toBe("server_error");
    expect(err.message).toContain("500");
  });
});

describe("listModels", () => {
  it("returns ok:true on 200", async () => {
    server.use(
      http.get(`${GEMINI_BASE}/models`, () =>
        HttpResponse.json({ models: [{ name: "models/gemini-2.0-flash-exp" }] }),
      ),
    );
    const result = await listModels("test-key");
    expect(result.ok).toBe(true);
  });

  it("returns auth_failed on 401", async () => {
    server.use(
      http.get(`${GEMINI_BASE}/models`, () =>
        HttpResponse.json(
          { error: { message: "API key not valid", status: "UNAUTHENTICATED" } },
          { status: 401 },
        ),
      ),
    );
    const result = await listModels("bad-key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("auth_failed");
    }
  });

  it("returns auth_failed on 403", async () => {
    server.use(
      http.get(`${GEMINI_BASE}/models`, () =>
        HttpResponse.json(
          { error: { message: "forbidden", status: "PERMISSION_DENIED" } },
          { status: 403 },
        ),
      ),
    );
    const result = await listModels("bad-key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("auth_failed");
    }
  });

  it("returns server_error on 500", async () => {
    server.use(
      http.get(`${GEMINI_BASE}/models`, () =>
        HttpResponse.json(
          { error: { message: "internal error" } },
          { status: 500 },
        ),
      ),
    );
    const result = await listModels("test-key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("server_error");
    }
  });

  it("returns network_error on fetch failure", async () => {
    server.use(
      http.get(`${GEMINI_BASE}/models`, () => HttpResponse.error()),
    );
    const result = await listModels("test-key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("network_error");
    }
  });
});

describe("generate", () => {
  it("returns image ArrayBuffer on success", async () => {
    server.use(
      http.post(`${GEMINI_BASE}/models/*`, () =>
        HttpResponse.json(geminiSuccessBody()),
      ),
    );
    const result = await generate("test-key", {
      prompt: "a cat",
      aspectRatio: "1:1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.image.byteLength).toBeGreaterThan(0);
      expect(result.mimeType).toBe("image/png");
    }
  });

  it("sends correct request body shape", async () => {
    let capturedBody: unknown;
    server.use(
      http.post(`${GEMINI_BASE}/models/*`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(geminiSuccessBody());
      }),
    );
    await generate("test-key", {
      prompt: "a sunset",
      aspectRatio: "16:9",
    });
    const body = capturedBody as Record<string, unknown>;
    expect(body.contents).toBeDefined();
    const config = body.generation_config as Record<string, unknown>;
    expect(config.response_modalities).toEqual(["TEXT", "IMAGE"]);
    const image = config.image as Record<string, unknown>;
    expect(image.aspect_ratio).toBe("16:9");
  });

  it("returns error on 401", async () => {
    server.use(
      http.post(`${GEMINI_BASE}/models/*`, () =>
        HttpResponse.json(
          { error: { message: "bad key", status: "UNAUTHENTICATED" } },
          { status: 401 },
        ),
      ),
    );
    const result = await generate("bad-key", {
      prompt: "test",
      aspectRatio: "1:1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("auth_failed");
    }
  });

  it("returns rate_limited on 429", async () => {
    server.use(
      http.post(`${GEMINI_BASE}/models/*`, () =>
        HttpResponse.json(
          { error: { message: "too many", status: "RESOURCE_EXHAUSTED" } },
          { status: 429 },
        ),
      ),
    );
    const result = await generate("test-key", {
      prompt: "test",
      aspectRatio: "1:1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("rate_limited");
    }
  });

  it("returns content_blocked when no image in response", async () => {
    server.use(
      http.post(`${GEMINI_BASE}/models/*`, () =>
        HttpResponse.json({
          candidates: [{ content: { parts: [{ text: "I cannot generate that image." }] } }],
        }),
      ),
    );
    const result = await generate("test-key", {
      prompt: "test",
      aspectRatio: "1:1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("content_blocked");
    }
  });

  it("returns unknown when no candidates", async () => {
    server.use(
      http.post(`${GEMINI_BASE}/models/*`, () =>
        HttpResponse.json({ candidates: [] }),
      ),
    );
    const result = await generate("test-key", {
      prompt: "test",
      aspectRatio: "1:1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unknown");
    }
  });

  it("returns network_error on fetch failure", async () => {
    server.use(
      http.post(`${GEMINI_BASE}/models/*`, () => HttpResponse.error()),
    );
    const result = await generate("test-key", {
      prompt: "test",
      aspectRatio: "1:1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("network_error");
    }
  });

  it("returns network_error on abort", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await generate("test-key", {
      prompt: "test",
      aspectRatio: "1:1",
      signal: controller.signal,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("network_error");
      expect(result.error.message).toContain("abort");
    }
  });

  it("returns server_error on 500", async () => {
    server.use(
      http.post(`${GEMINI_BASE}/models/*`, () =>
        HttpResponse.json(
          { error: { message: "internal" } },
          { status: 500 },
        ),
      ),
    );
    const result = await generate("test-key", {
      prompt: "test",
      aspectRatio: "1:1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("server_error");
    }
  });
});
