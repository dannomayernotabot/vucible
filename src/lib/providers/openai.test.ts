import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../vitest.setup";
import { testGenerate, generate } from "./openai";
import { PNG_1x1 } from "@/test/fixtures/images";
import { JPEG_SAMPLE, WEBP_SAMPLE } from "@/test/fixtures/images";

const OPENAI_BASE = "https://api.openai.com/v1";
const API_KEY = "sk-test-key";

function b64Encode(data: string): string {
  return btoa(data);
}

const FAKE_B64_IMAGE = b64Encode("fake-png-bytes");

describe("testGenerate", () => {
  it("returns ok:true with detected tier from x-ratelimit-limit-images", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json(
          { data: [{ b64_json: FAKE_B64_IMAGE }] },
          {
            headers: {
              "x-ratelimit-limit-images": "20",
            },
          },
        );
      }),
    );
    const result = await testGenerate(API_KEY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tier).toBe("tier2");
      expect(result.ipm).toBe(20);
    }
  });

  it("falls back to x-ratelimit-limit-requests when -images missing", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json(
          { data: [{ b64_json: FAKE_B64_IMAGE }] },
          {
            headers: {
              "x-ratelimit-limit-requests": "50",
            },
          },
        );
      }),
    );
    const result = await testGenerate(API_KEY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tier).toBe("tier3");
      expect(result.ipm).toBe(50);
    }
  });

  it("defaults to ipm=5 when no rate-limit headers", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json({ data: [{ b64_json: FAKE_B64_IMAGE }] });
      }),
    );
    const result = await testGenerate(API_KEY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ipm).toBe(5);
      expect(result.tier).toBe("tier1");
    }
  });

  it("returns auth_failed on 401", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json(
          { error: { message: "Invalid API key", type: "invalid_request_error" } },
          { status: 401 },
        );
      }),
    );
    const result = await testGenerate(API_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("auth_failed");
      expect(result.error.httpStatus).toBe(401);
    }
  });

  it("returns rate_limited on 429 with retryAfterSeconds", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json(
          { error: { message: "Rate limit exceeded" } },
          { status: 429, headers: { "retry-after": "30" } },
        );
      }),
    );
    const result = await testGenerate(API_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("rate_limited");
      expect(result.error.retryAfterSeconds).toBe(30);
    }
  });

  it("returns bad_request on 400", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json(
          { error: { message: "Invalid size" } },
          { status: 400 },
        );
      }),
    );
    const result = await testGenerate(API_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("bad_request");
    }
  });

  it("returns content_blocked on 400 with content_policy_violation", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json(
          { error: { message: "Content blocked", code: "content_policy_violation" } },
          { status: 400 },
        );
      }),
    );
    const result = await testGenerate(API_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("content_blocked");
    }
  });

  it("returns server_error on 500", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json(
          { error: { message: "Internal error" } },
          { status: 500 },
        );
      }),
    );
    const result = await testGenerate(API_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("server_error");
      expect(result.error.httpStatus).toBe(500);
    }
  });

  it("returns quota_exhausted on 402", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json(
          { error: { message: "Billing required" } },
          { status: 402 },
        );
      }),
    );
    const result = await testGenerate(API_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("quota_exhausted");
    }
  });

  it("returns verification_required on 403 with verification message", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json(
          {
            error: {
              message:
                "You must be verified to use the model `gpt-image-1`. Please visit https://platform.openai.com/settings/organization/general to complete verification.",
              type: "invalid_request_error",
            },
          },
          { status: 403 },
        );
      }),
    );
    const result = await testGenerate(API_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("verification_required");
      expect(result.error.model).toBe("gpt-image-1");
      expect(result.error.deepLink).toBe(
        "https://platform.openai.com/settings/organization/general",
      );
      expect(result.error.httpStatus).toBe(403);
    }
  });

  it("returns auth_failed on 403 without verification message", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json(
          { error: { message: "Access denied", type: "invalid_request_error" } },
          { status: 403 },
        );
      }),
    );
    const result = await testGenerate(API_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("auth_failed");
      expect(result.error.httpStatus).toBe(403);
    }
  });

  it("returns network_error on fetch failure", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.error();
      }),
    );
    const result = await testGenerate(API_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("network_error");
    }
  });
});

describe("generate", () => {
  it("returns ArrayBuffer of image bytes on success", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json({
          data: [{ b64_json: FAKE_B64_IMAGE }],
        });
      }),
    );
    const result = await generate(API_KEY, {
      prompt: "a red square",
      size: { width: 1024, height: 1024 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.image).toBeInstanceOf(ArrayBuffer);
      expect(result.image.byteLength).toBeGreaterThan(0);
      expect(result.mimeType).toBe("image/png");
      expect(result.meta).toEqual({ width: 1024, height: 1024 });
    }
  });

  it("returns error when response has no image data", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json({ data: [] });
      }),
    );
    const result = await generate(API_KEY, {
      prompt: "test",
      size: { width: 512, height: 512 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unknown");
      expect(result.error.message).toBe("No image data in response");
    }
  });

  it("returns network_error with 'Cancelled' for AbortError", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await generate(API_KEY, {
      prompt: "test",
      size: { width: 512, height: 512 },
      signal: controller.signal,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("network_error");
      expect(result.error.message).toBe("Cancelled.");
    }
  });

  it("sends correct request body", async () => {
    let capturedBody: unknown;
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ data: [{ b64_json: FAKE_B64_IMAGE }] });
      }),
    );
    await generate(API_KEY, {
      prompt: "a blue circle",
      size: { width: 1024, height: 1024 },
    });
    expect(capturedBody).toEqual({
      model: "gpt-image-1",
      prompt: "a blue circle",
      n: 1,
      size: "1024x1024",
    });
  });

  it("returns error on auth failure", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json(
          { error: { message: "Bad key" } },
          { status: 401 },
        );
      }),
    );
    const result = await generate(API_KEY, {
      prompt: "test",
      size: { width: 512, height: 512 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("auth_failed");
    }
  });
});

describe("generate with reference images", () => {
  it("sends multipart content-type when references provided", async () => {
    let capturedContentType: string | null = null;
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, ({ request }) => {
        capturedContentType = request.headers.get("content-type");
        return HttpResponse.json({ data: [{ b64_json: FAKE_B64_IMAGE }] });
      }),
    );
    await generate(API_KEY, {
      prompt: "evolve this",
      size: { width: 1024, height: 1024 },
      referenceImages: [{ bytes: PNG_1x1, mimeType: "image/png" }],
    });
    expect(capturedContentType).toContain("multipart/form-data");
  });

  it("does not set explicit Content-Type (lets browser set boundary)", async () => {
    let capturedContentType: string | null = null;
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, ({ request }) => {
        capturedContentType = request.headers.get("content-type");
        return HttpResponse.json({ data: [{ b64_json: FAKE_B64_IMAGE }] });
      }),
    );
    await generate(API_KEY, {
      prompt: "test",
      size: { width: 512, height: 512 },
      referenceImages: [{ bytes: PNG_1x1, mimeType: "image/png" }],
    });
    expect(capturedContentType).toContain("boundary=");
  });

  it("returns ArrayBuffer from 200 response with references", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json({ data: [{ b64_json: FAKE_B64_IMAGE }] });
      }),
    );
    const result = await generate(API_KEY, {
      prompt: "test",
      size: { width: 512, height: 512 },
      referenceImages: [{ bytes: PNG_1x1, mimeType: "image/png" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.image).toBeInstanceOf(ArrayBuffer);
      expect(result.image.byteLength).toBeGreaterThan(0);
    }
  });

  it("sends JSON body without references", async () => {
    let capturedContentType: string | null = null;
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, ({ request }) => {
        capturedContentType = request.headers.get("content-type");
        return HttpResponse.json({ data: [{ b64_json: FAKE_B64_IMAGE }] });
      }),
    );
    await generate(API_KEY, {
      prompt: "test",
      size: { width: 512, height: 512 },
    });
    expect(capturedContentType).toBe("application/json");
  });

  it("returns error on auth failure with references", async () => {
    server.use(
      http.post(`${OPENAI_BASE}/images/generations`, () => {
        return HttpResponse.json(
          { error: { message: "Bad key" } },
          { status: 401 },
        );
      }),
    );
    const result = await generate(API_KEY, {
      prompt: "test",
      size: { width: 512, height: 512 },
      referenceImages: [{ bytes: PNG_1x1, mimeType: "image/png" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("auth_failed");
    }
  });
});
