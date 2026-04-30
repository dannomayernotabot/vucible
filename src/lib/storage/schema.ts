import { monotonicFactory } from "ulid";
import type {
  AspectRatioConfig,
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
  width?: number;
  height?: number;
}

export type RoundResult =
  | {
      status: "success";
      bytes: ArrayBuffer;
      thumbnail: ArrayBuffer;
      mimeType: string;
      meta: ImageMeta;
    }
  | { status: "error"; error: NormalizedError };

export interface Session {
  id: string;
  startedAt: string;
  originalPrompt: string;
  roundIds: string[];
}

export interface Round {
  id: string;
  sessionId: string;
  number: number;
  promptSent: string;
  modelsEnabled: { openai: boolean; gemini: boolean };
  imageCount: 4 | 8 | 16;
  aspect: AspectRatioConfig;
  openaiResults: RoundResult[];
  geminiResults: RoundResult[];
  selections: { provider: Provider; index: number }[];
  commentary: string | null;
  startedAt: string;
  settledAt: string | null;
}

export type { VucibleStorageV1 } from "@/lib/providers/types";
