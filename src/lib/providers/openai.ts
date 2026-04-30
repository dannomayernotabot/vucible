import type { NormalizedError } from "./errors";
import type { Tier } from "./types";
import type { ImageMeta } from "@/lib/storage/schema";
import { ipmToTier } from "./tiers";

const OPENAI_BASE = "https://api.openai.com/v1";
const OPENAI_IMAGE_MODEL = "gpt-image-1";
const TEST_PROMPT = "a single solid color square";

export async function testGenerate(
  apiKey: string,
): Promise<
  | { ok: true; tier: Tier; ipm: number }
  | { ok: false; error: NormalizedError }
> {
  let response: Response;
  try {
    response = await fetch(`${OPENAI_BASE}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt: TEST_PROMPT,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });
  } catch (err) {
    return { ok: false, error: mapNetworkError(err) };
  }

  if (!response.ok) {
    return { ok: false, error: await mapResponseError(response) };
  }

  const ipm = parseIpm(response.headers);
  const tier = ipmToTier(ipm);
  return { ok: true, tier, ipm };
}

export interface ReferenceImage {
  readonly bytes: ArrayBuffer;
  readonly mimeType: string;
}

export async function generate(
  apiKey: string,
  args: {
    prompt: string;
    size: { width: number; height: number };
    referenceImages?: ReferenceImage[];
    signal?: AbortSignal;
  },
): Promise<
  | { ok: true; image: ArrayBuffer; mimeType: string; meta: ImageMeta }
  | { ok: false; error: NormalizedError }
> {
  const hasRefs = args.referenceImages && args.referenceImages.length > 0;

  let response: Response;
  try {
    if (hasRefs) {
      const form = new FormData();
      form.append("model", OPENAI_IMAGE_MODEL);
      form.append("prompt", args.prompt);
      form.append("n", "1");
      form.append("size", `${args.size.width}x${args.size.height}`);
      form.append("response_format", "b64_json");
      for (const ref of args.referenceImages!) {
        form.append("image[]", new Blob([ref.bytes], { type: ref.mimeType }));
      }
      response = await fetch(`${OPENAI_BASE}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: args.signal,
      });
    } else {
      response = await fetch(`${OPENAI_BASE}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_IMAGE_MODEL,
          prompt: args.prompt,
          n: 1,
          size: `${args.size.width}x${args.size.height}`,
          response_format: "b64_json",
        }),
        signal: args.signal,
      });
    }
  } catch (err) {
    return { ok: false, error: mapNetworkError(err) };
  }

  if (!response.ok) {
    return { ok: false, error: await mapResponseError(response) };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      error: { kind: "unknown", message: "Invalid JSON in response" },
    };
  }

  const record = body as { data?: { b64_json?: string }[] };
  const b64 = record?.data?.[0]?.b64_json;
  if (!b64) {
    return {
      ok: false,
      error: { kind: "unknown", message: "No image data in response" },
    };
  }

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return {
    ok: true,
    image: bytes.buffer as ArrayBuffer,
    mimeType: "image/png",
    meta: { width: args.size.width, height: args.size.height },
  };
}

function parseIpm(headers: Headers): number {
  const images = headers.get("x-ratelimit-limit-images");
  if (images) return parseInt(images, 10) || 5;

  const requests = headers.get("x-ratelimit-limit-requests");
  if (requests) return parseInt(requests, 10) || 5;

  return 5;
}

function mapNetworkError(err: unknown): NormalizedError {
  const name = err instanceof Error ? err.name : "";
  if (name === "AbortError") {
    return { kind: "network_error", message: "Cancelled.", raw: err };
  }
  return {
    kind: "network_error",
    message: "Couldn't reach OpenAI. Check your network connection.",
    raw: err,
  };
}

async function mapResponseError(response: Response): Promise<NormalizedError> {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // body stays null
  }

  const errorObj = body?.error as Record<string, unknown> | undefined;
  const message =
    typeof errorObj?.message === "string"
      ? errorObj.message
      : `HTTP ${response.status}`;

  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) || undefined : undefined;

  switch (response.status) {
    case 401:
    case 403:
      return { kind: "auth_failed", message, httpStatus: response.status, raw: body };
    case 429:
      return {
        kind: "rate_limited",
        message,
        httpStatus: 429,
        retryAfterSeconds,
        raw: body,
      };
    case 400:
      if (typeof errorObj?.code === "string" && errorObj.code === "content_policy_violation") {
        return { kind: "content_blocked", message, httpStatus: 400, raw: body };
      }
      return { kind: "bad_request", message, httpStatus: 400, raw: body };
    case 402:
      return { kind: "quota_exhausted", message, httpStatus: 402, raw: body };
    default:
      if (response.status >= 500) {
        return { kind: "server_error", message, httpStatus: response.status, raw: body };
      }
      return { kind: "unknown", message, httpStatus: response.status, raw: body };
  }
}
