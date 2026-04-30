import type {
  ImageCount,
  AspectRatioConfig,
  Provider,
  GeminiSupportedRatio,
} from "@/lib/providers/types";
import type { Round, RoundResult } from "@/lib/storage/schema";
import type { NormalizedError } from "@/lib/providers/errors";
import { generateId } from "@/lib/storage/schema";
import {
  createSession,
  appendRoundToSession,
  putRoundPlaceholder,
  finalizeRound,
} from "@/lib/storage/history";
import { getStorage } from "@/lib/storage/keys";
import { snapAspectIfNeeded } from "./aspect";
import { generate as openaiGenerate } from "@/lib/providers/openai";
import { generate as geminiGenerate } from "@/lib/providers/gemini";
import { withRetry } from "./retry";
import { generateThumbnail } from "./thumbnails";
import type { ProviderThrottle } from "./throttle";

export interface StartRoundInput {
  readonly prompt: string;
  readonly modelsEnabled: { readonly openai: boolean; readonly gemini: boolean };
  readonly count: ImageCount;
  readonly aspect: AspectRatioConfig;
  readonly sessionId?: string;
}

export interface StartRoundResult {
  readonly round: Round;
  readonly sessionId: string;
}

export async function startRoundOne(
  input: StartRoundInput,
): Promise<StartRoundResult> {
  const trimmedPrompt = input.prompt.trim();
  if (!trimmedPrompt) {
    throw new Error("Prompt must not be empty.");
  }

  if (!input.modelsEnabled.openai && !input.modelsEnabled.gemini) {
    throw new Error("At least one provider must be enabled.");
  }

  const validCounts: number[] = [4, 8, 16];
  if (!validCounts.includes(input.count)) {
    throw new Error(`Invalid image count: ${input.count}`);
  }

  const storage = getStorage();
  const providers = storage?.providers ?? {};
  const aspect = snapAspectIfNeeded(input.aspect, providers);

  const bothEnabled = input.modelsEnabled.openai && input.modelsEnabled.gemini;
  const openaiCount = input.modelsEnabled.openai
    ? bothEnabled
      ? Math.ceil(input.count / 2)
      : input.count
    : 0;
  const geminiCount = input.modelsEnabled.gemini
    ? bothEnabled
      ? Math.floor(input.count / 2)
      : input.count
    : 0;

  const loadingSlot: RoundResult = { status: "loading" };
  const openaiResults: RoundResult[] = Array.from(
    { length: openaiCount },
    () => loadingSlot,
  );
  const geminiResults: RoundResult[] = Array.from(
    { length: geminiCount },
    () => loadingSlot,
  );

  let sessionId = input.sessionId;
  if (!sessionId) {
    const session = await createSession(trimmedPrompt);
    sessionId = session.id;
  }

  const round: Round = {
    id: generateId(),
    sessionId,
    number: 1,
    promptSent: trimmedPrompt,
    modelsEnabled: input.modelsEnabled,
    imageCount: input.count,
    aspect,
    openaiResults,
    geminiResults,
    selections: [],
    commentary: null,
    startedAt: new Date().toISOString(),
    settledAt: null,
  };

  await putRoundPlaceholder(round);
  await appendRoundToSession(sessionId, round.id);

  return { round, sessionId };
}

function aspectToOpenAISize(aspect: AspectRatioConfig): { width: number; height: number } {
  if (aspect.kind === "freeform") {
    return { width: aspect.width, height: aspect.height };
  }
  const [a, b] = aspect.ratio.split(":").map(Number);
  const scale = 1024 / Math.max(a, b);
  return { width: Math.round(a * scale), height: Math.round(b * scale) };
}

function aspectToGeminiRatio(aspect: AspectRatioConfig): GeminiSupportedRatio {
  if (aspect.kind === "discrete") return aspect.ratio;
  return "1:1";
}

export type SlotUpdate = {
  provider: Provider;
  index: number;
  result: RoundResult;
};

export interface FanOutOptions {
  round: Round;
  signal: AbortSignal;
  throttles: { openai?: ProviderThrottle; gemini?: ProviderThrottle };
  onSlotUpdate: (update: SlotUpdate) => void;
}

export async function fanOut(opts: FanOutOptions): Promise<Round> {
  const { round, signal, throttles, onSlotUpdate } = opts;
  const storage = getStorage();
  if (!storage) throw new Error("No storage available.");

  const openaiKey = storage.providers.openai?.apiKey;
  const geminiKey = storage.providers.gemini?.apiKey;

  const openaiSize = aspectToOpenAISize(round.aspect);
  const geminiRatio = aspectToGeminiRatio(round.aspect);

  const openaiResults = [...round.openaiResults] as RoundResult[];
  const geminiResults = [...round.geminiResults] as RoundResult[];

  const tasks: Promise<void>[] = [];

  for (let i = 0; i < openaiResults.length; i++) {
    if (!openaiKey) continue;
    const index = i;
    const task = async () => {
      const doGenerate = async () => {
        const result = await withRetry(
          (sig) =>
            openaiGenerate(openaiKey, {
              prompt: round.promptSent,
              size: openaiSize,
              signal: sig,
            }),
          { signal },
        );
        if (!result.ok) {
          throw result.error;
        }
        return result;
      };

      try {
        const enqueue = throttles.openai
          ? () => throttles.openai!.enqueue(doGenerate)
          : doGenerate;
        const result = await enqueue();
        const slot: RoundResult = {
          status: "success",
          bytes: result.image,
          thumbnail: result.image,
          mimeType: result.mimeType,
          meta: result.meta,
        };
        openaiResults[index] = slot;
        onSlotUpdate({ provider: "openai", index, result: slot });
      } catch (err) {
        const error: NormalizedError =
          typeof err === "object" && err !== null && "kind" in err
            ? (err as NormalizedError)
            : { kind: "unknown", message: String(err) };
        const slot: RoundResult = { status: "error", error };
        openaiResults[index] = slot;
        onSlotUpdate({ provider: "openai", index, result: slot });
      }
    };
    tasks.push(task());
  }

  for (let i = 0; i < geminiResults.length; i++) {
    if (!geminiKey) continue;
    const index = i;
    const task = async () => {
      const doGenerate = async () => {
        const result = await withRetry(
          (sig) =>
            geminiGenerate(geminiKey, {
              prompt: round.promptSent,
              aspectRatio: geminiRatio,
              signal: sig,
            }),
          { signal },
        );
        if (!result.ok) {
          throw result.error;
        }
        return result;
      };

      try {
        const enqueue = throttles.gemini
          ? () => throttles.gemini!.enqueue(doGenerate)
          : doGenerate;
        const result = await enqueue();
        const slot: RoundResult = {
          status: "success",
          bytes: result.image,
          thumbnail: result.image,
          mimeType: result.mimeType,
          meta: result.meta,
        };
        geminiResults[index] = slot;
        onSlotUpdate({ provider: "gemini", index, result: slot });
      } catch (err) {
        const error: NormalizedError =
          typeof err === "object" && err !== null && "kind" in err
            ? (err as NormalizedError)
            : { kind: "unknown", message: String(err) };
        const slot: RoundResult = { status: "error", error };
        geminiResults[index] = slot;
        onSlotUpdate({ provider: "gemini", index, result: slot });
      }
    };
    tasks.push(task());
  }

  await Promise.allSettled(tasks);

  const allResults = [
    ...openaiResults.map((r, i) => ({ results: openaiResults, index: i, r })),
    ...geminiResults.map((r, i) => ({ results: geminiResults, index: i, r })),
  ];

  await Promise.all(
    allResults
      .filter(({ r }) => r.status === "success")
      .map(async ({ results, index, r }) => {
        if (r.status !== "success") return;
        try {
          const { thumbnail } = await generateThumbnail(r.bytes, r.mimeType);
          results[index] = { ...r, thumbnail };
        } catch {
          // Thumbnail failure is non-fatal; keep full image as fallback
        }
      }),
  );

  const settled: Round = {
    ...round,
    openaiResults,
    geminiResults,
    settledAt: new Date().toISOString(),
  };

  await finalizeRound(settled);

  return settled;
}
