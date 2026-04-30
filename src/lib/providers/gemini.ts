import type { NormalizedError } from "./errors";
import type { GeminiSupportedRatio } from "./types";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_IMAGE_MODEL = "gemini-2.0-flash-exp";

export interface ReferenceImage {
  readonly base64: string;
  readonly mimeType: string;
}

export interface GenerateArgs {
  readonly prompt: string;
  readonly aspectRatio: GeminiSupportedRatio;
  readonly referenceImages?: readonly ReferenceImage[];
  readonly signal?: AbortSignal;
}

export type ListModelsResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: NormalizedError };

export type GenerateResult =
  | {
      readonly ok: true;
      readonly image: ArrayBuffer;
      readonly mimeType: string;
      readonly meta: Record<string, unknown>;
    }
  | { readonly ok: false; readonly error: NormalizedError };

export function mapError(status: number, body: unknown): NormalizedError {
  const bodyObj = typeof body === "object" && body !== null ? body : {};
  const errorObj =
    "error" in bodyObj
      ? (bodyObj as Record<string, unknown>).error
      : bodyObj;
  const errRecord =
    typeof errorObj === "object" && errorObj !== null
      ? (errorObj as Record<string, unknown>)
      : {};
  const message =
    typeof errRecord.message === "string"
      ? errRecord.message
      : `Gemini API error (${status})`;
  const errorStatus =
    typeof errRecord.status === "string" ? errRecord.status : "";

  if (status === 401 || status === 403) {
    return { kind: "auth_failed", message, httpStatus: status, raw: body };
  }
  if (status === 429) {
    if (
      errorStatus === "RESOURCE_EXHAUSTED" &&
      message.toLowerCase().includes("quota")
    ) {
      return { kind: "quota_exhausted", message, httpStatus: status, raw: body };
    }
    return { kind: "rate_limited", message, httpStatus: status, raw: body };
  }
  if (status === 400) {
    if (errorStatus === "INVALID_ARGUMENT") {
      if (
        message.toLowerCase().includes("safety") ||
        message.toLowerCase().includes("block")
      ) {
        return {
          kind: "content_blocked",
          message,
          httpStatus: status,
          raw: body,
        };
      }
      return { kind: "bad_request", message, httpStatus: status, raw: body };
    }
    return { kind: "bad_request", message, httpStatus: status, raw: body };
  }
  if (status >= 500) {
    return { kind: "server_error", message, httpStatus: status, raw: body };
  }
  return { kind: "unknown", message, httpStatus: status, raw: body };
}

export async function listModels(apiKey: string): Promise<ListModelsResult> {
  let response: Response;
  try {
    response = await fetch(`${GEMINI_BASE}/models?key=${encodeURIComponent(apiKey)}`);
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "network_error",
        message: err instanceof Error ? err.message : "Network request failed",
        raw: err,
      },
    };
  }

  if (response.ok) {
    return { ok: true };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { ok: false, error: mapError(response.status, body) };
}

export async function generate(
  apiKey: string,
  args: GenerateArgs,
): Promise<GenerateResult> {
  const { prompt, aspectRatio, referenceImages, signal } = args;

  const parts: Record<string, unknown>[] = [{ text: prompt }];
  if (referenceImages) {
    for (const ref of referenceImages) {
      parts.push({
        inline_data: { mime_type: ref.mimeType, data: ref.base64 },
      });
    }
  }

  const requestBody = {
    contents: [{ parts }],
    generation_config: {
      response_modalities: ["TEXT", "IMAGE"],
      image: {
        aspect_ratio: aspectRatio,
      },
    },
  };

  let response: Response;
  try {
    response = await fetch(
      `${GEMINI_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal,
      },
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        ok: false,
        error: {
          kind: "network_error",
          message: "Request aborted",
          raw: err,
        },
      };
    }
    return {
      ok: false,
      error: {
        kind: "network_error",
        message: err instanceof Error ? err.message : "Network request failed",
        raw: err,
      },
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    return { ok: false, error: mapError(response.status, body) };
  }

  const candidates = extractCandidates(body);
  if (!candidates) {
    return {
      ok: false,
      error: {
        kind: "unknown",
        message: "No candidates in Gemini response",
        httpStatus: response.status,
        raw: body,
      },
    };
  }

  const imagePart = findInlineImage(candidates);
  if (!imagePart) {
    return {
      ok: false,
      error: {
        kind: "content_blocked",
        message: "No image in Gemini response (may have been filtered)",
        httpStatus: response.status,
        raw: body,
      },
    };
  }

  const bytes = base64ToArrayBuffer(imagePart.data);
  return {
    ok: true,
    image: bytes,
    mimeType: imagePart.mimeType,
    meta: {},
  };
}

function extractCandidates(body: unknown): unknown[] | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.candidates) || record.candidates.length === 0)
    return null;
  return record.candidates;
}

function findInlineImage(
  candidates: unknown[],
): { data: string; mimeType: string } | null {
  for (const candidate of candidates) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const content = (candidate as Record<string, unknown>).content;
    if (typeof content !== "object" || content === null) continue;
    const parts = (content as Record<string, unknown>).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (typeof part !== "object" || part === null) continue;
      const p = part as Record<string, unknown>;
      if (typeof p.inline_data !== "object" || p.inline_data === null) continue;
      const inlineData = p.inline_data as Record<string, unknown>;
      if (
        typeof inlineData.data === "string" &&
        typeof inlineData.mime_type === "string"
      ) {
        return { data: inlineData.data, mimeType: inlineData.mime_type };
      }
    }
  }
  return null;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}
