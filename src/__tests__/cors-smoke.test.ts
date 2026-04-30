import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server } from "../../vitest.setup";

beforeAll(() => server.close());
afterAll(() => server.listen({ onUnhandledRequest: "error" }));

const ORIGIN = "https://vucible.vercel.app";

const OPENAI_BASE = "https://api.openai.com/v1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com";

const OPENAI_JUNK_KEY = "sk-junk-cors-test";
const GEMINI_JUNK_KEY = "AIzaSy-junk-cors-test";

interface CorsResult {
  status: number;
  allowOrigin: string | null;
  allowMethods: string | null;
  allowHeaders: string | null;
}

async function sendPreflight(
  url: string,
  method: string,
  requestHeaders: string,
): Promise<CorsResult> {
  const resp = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: ORIGIN,
      "Access-Control-Request-Method": method,
      "Access-Control-Request-Headers": requestHeaders,
    },
  });
  return {
    status: resp.status,
    allowOrigin: resp.headers.get("access-control-allow-origin"),
    allowMethods: resp.headers.get("access-control-allow-methods"),
    allowHeaders: resp.headers.get("access-control-allow-headers"),
  };
}

async function sendActual(
  url: string,
  init: RequestInit,
): Promise<CorsResult & { bodyPreview: string }> {
  const headers = new Headers(init.headers);
  headers.set("Origin", ORIGIN);

  const resp = await fetch(url, { ...init, headers });
  const body = await resp.text();
  return {
    status: resp.status,
    allowOrigin: resp.headers.get("access-control-allow-origin"),
    allowMethods: resp.headers.get("access-control-allow-methods"),
    allowHeaders: resp.headers.get("access-control-allow-headers"),
    bodyPreview: body.slice(0, 300),
  };
}

// §14.T CORS viability test — resolves architecture gate vucible-r0k.
//
// Both providers must accept browser-origin requests. We test with junk keys
// because CORS reachability is orthogonal to auth correctness.
//
// OUTCOME (2026-04-29): T1 — both providers allow browser-origin calls.
//
// Caveat: OpenAI's image endpoints strip CORS headers on 401 error responses
// (Cloudflare edge behavior). Preflight passes, and valid-key 200 responses
// have CORS headers, but bad-key 401s are opaque in a browser. Workaround:
// validate key via GET /v1/models (CORS-clean on 401) before test-gen.

describe("CORS browser-origin smoke test (vucible-r0k)", () => {
  describe("OpenAI", () => {
    it("preflight to /v1/images/generations passes", async () => {
      const r = await sendPreflight(
        `${OPENAI_BASE}/images/generations`,
        "POST",
        "content-type, authorization",
      );
      expect(r.status).toBe(200);
      expect(r.allowOrigin).toBe("*");
      expect(r.allowMethods).toContain("POST");
      expect(r.allowHeaders).toContain("authorization");
      expect(r.allowHeaders).toContain("content-type");
    });

    it("preflight to /v1/images/edits passes", async () => {
      const r = await sendPreflight(
        `${OPENAI_BASE}/images/edits`,
        "POST",
        "authorization",
      );
      expect(r.status).toBe(200);
      expect(r.allowOrigin).toBe("*");
      expect(r.allowMethods).toContain("POST");
    });

    it("GET /v1/models returns CORS headers even on 401", async () => {
      const r = await sendActual(`${OPENAI_BASE}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${OPENAI_JUNK_KEY}` },
      });
      expect(r.status).toBe(401);
      expect(r.allowOrigin).toBe("*");
      expect(r.bodyPreview).toContain("invalid_api_key");
    });

    it("POST /v1/images/generations 401 lacks CORS headers (known Cloudflare behavior)", async () => {
      const r = await sendActual(`${OPENAI_BASE}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_JUNK_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: "test",
          n: 1,
          size: "256x256",
        }),
      });
      expect(r.status).toBe(401);
      // Known: Cloudflare strips CORS headers on 401 for image endpoints.
      // In a browser, this means bad-key errors are opaque (generic "Failed to fetch").
      // Workaround: validate key via GET /v1/models first (CORS-clean on 401).
      expect(r.allowOrigin).toBeNull();
      expect(r.bodyPreview).toContain("invalid_api_key");
    });
  });

  describe("Gemini", () => {
    it("GET /v1/models returns CORS headers on 400", async () => {
      const r = await sendActual(
        `${GEMINI_BASE}/v1/models?key=${GEMINI_JUNK_KEY}`,
        { method: "GET" },
      );
      expect(r.status).toBe(400);
      expect(r.allowOrigin).toBeTruthy();
      expect(r.bodyPreview).toContain("API_KEY_INVALID");
    });

    it("preflight to /v1beta generateContent passes", async () => {
      const r = await sendPreflight(
        `${GEMINI_BASE}/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_JUNK_KEY}`,
        "POST",
        "content-type",
      );
      expect(r.status).toBe(200);
      expect(r.allowOrigin).toBeTruthy();
      expect(r.allowMethods).toContain("POST");
      expect(r.allowHeaders).toContain("content-type");
    });

    it("POST /v1beta generateContent returns CORS headers on 400", async () => {
      const r = await sendActual(
        `${GEMINI_BASE}/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_JUNK_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "test" }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }),
        },
      );
      expect(r.status).toBe(400);
      expect(r.allowOrigin).toBeTruthy();
      expect(r.bodyPreview).toContain("API_KEY_INVALID");
    });
  });
});
