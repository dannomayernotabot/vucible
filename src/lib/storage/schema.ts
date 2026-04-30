import { monotonicFactory } from "ulid";
import type {
  AspectRatioConfig,
  ImageCount,
  Provider,
} from "@/lib/providers/types";
import type { NormalizedError } from "@/lib/providers/errors";

const monotonic = monotonicFactory();

export function generateId(): string {
  return monotonic();
}

export const DB_NAME = "vucible-history";
export const DB_VERSION = 1;
export const STORAGE_KEY = "vucible:v1";

export interface ImageMeta {
  readonly width?: number;
  readonly height?: number;
}

export type RoundResult =
  | {
      readonly status: "success";
      readonly bytes: ArrayBuffer;
      readonly thumbnail: ArrayBuffer;
      readonly mimeType: string;
      readonly meta: ImageMeta;
    }
  | { readonly status: "error"; readonly error: NormalizedError };

export interface Session {
  readonly id: string;
  readonly startedAt: string;
  readonly originalPrompt: string;
  readonly roundIds: readonly string[];
}

export interface Round {
  readonly id: string;
  readonly sessionId: string;
  readonly number: number;
  readonly promptSent: string;
  readonly modelsEnabled: { readonly openai: boolean; readonly gemini: boolean };
  readonly imageCount: ImageCount;
  readonly aspect: AspectRatioConfig;
  readonly openaiResults: readonly RoundResult[];
  readonly geminiResults: readonly RoundResult[];
  readonly selections: readonly { readonly provider: Provider; readonly index: number }[];
  readonly commentary: string | null;
  readonly startedAt: string;
  readonly settledAt: string | null;
}

export type { VucibleStorageV1 } from "@/lib/providers/types";
