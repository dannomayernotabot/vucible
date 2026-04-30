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
  getRound,
  listRoundsBySession,
} from "@/lib/storage/history";
import { getStorage } from "@/lib/storage/keys";
import { snapAspectIfNeeded } from "./aspect";
import { generate as openaiGenerate } from "@/lib/providers/openai";
import { generate as geminiGenerate } from "@/lib/providers/gemini";
import { withRetry } from "./retry";
import { generateThumbnail } from "./thumbnails";
import { prepareReferences } from "./prepare-references";
import { buildEvolvePrompt } from "./prompt";
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
  openaiRefs?: { bytes: ArrayBuffer; mimeType: string }[];
  geminiRefs?: { base64: string; mimeType: string }[];
}

export async function fanOut(opts: FanOutOptions): Promise<Round> {
  const { round, signal, throttles, onSlotUpdate, openaiRefs, geminiRefs } = opts;
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
        return await withRetry(
          async (sig) => {
            const r = await openaiGenerate(openaiKey, {
              prompt: round.promptSent,
              size: openaiSize,
              referenceImages: openaiRefs,
              signal: sig,
            });
            if (!r.ok) throw r.error;
            return r;
          },
          { signal },
        );
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
        return await withRetry(
          async (sig) => {
            const r = await geminiGenerate(geminiKey, {
              prompt: round.promptSent,
              aspectRatio: geminiRatio,
              referenceImages: geminiRefs,
              signal: sig,
            });
            if (!r.ok) throw r.error;
            return r;
          },
          { signal },
        );
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

  try {
    await finalizeRound(settled);
  } catch (err) {
    if (
      err instanceof DOMException &&
      err.name === "QuotaExceededError"
    ) {
      console.warn("[orchestrate] Browser storage full — round saved in memory only");
    } else {
      throw err;
    }
  }

  return settled;
}

export interface StartRoundNInput {
  readonly sessionId: string;
  readonly priorRoundId: string;
  readonly selections: readonly { readonly provider: Provider; readonly index: number }[];
  readonly commentary: string | null;
  readonly modelsEnabled: { readonly openai: boolean; readonly gemini: boolean };
  readonly count: ImageCount;
  readonly aspect: AspectRatioConfig;
}

export interface StartRoundNResult {
  readonly round: Round;
  readonly priorRoundUpdated: Round;
  readonly openaiRefs: { bytes: ArrayBuffer; mimeType: string }[];
  readonly geminiRefs: { base64: string; mimeType: string }[];
}

export async function startRoundN(
  input: StartRoundNInput,
): Promise<StartRoundNResult> {
  if (input.selections.length === 0) {
    throw new Error("At least one selection is required for round 2+.");
  }

  const priorRound = await getRound(input.priorRoundId);
  if (!priorRound) {
    throw new Error(`Prior round ${input.priorRoundId} not found.`);
  }

  const refs = prepareReferences(priorRound, input.selections);

  const priorRounds = await listRoundsBySession(input.sessionId);
  const session = {
    id: input.sessionId,
    originalPrompt: priorRounds[0]?.promptSent ?? "",
    startedAt: "",
    roundIds: priorRounds.map((r) => r.id),
  };

  const prompt = buildEvolvePrompt(
    session.originalPrompt,
    priorRounds,
    input.selections,
    input.commentary,
  );

  const storage = getStorage();
  const providers = storage?.providers ?? {};
  const aspect = snapAspectIfNeeded(input.aspect, providers);

  const bothEnabled = input.modelsEnabled.openai && input.modelsEnabled.gemini;
  const openaiCount = input.modelsEnabled.openai
    ? bothEnabled ? Math.ceil(input.count / 2) : input.count
    : 0;
  const geminiCount = input.modelsEnabled.gemini
    ? bothEnabled ? Math.floor(input.count / 2) : input.count
    : 0;

  const loadingSlot: RoundResult = { status: "loading" };

  const round: Round = {
    id: generateId(),
    sessionId: input.sessionId,
    number: priorRound.number + 1,
    promptSent: prompt,
    modelsEnabled: input.modelsEnabled,
    imageCount: input.count,
    aspect,
    openaiResults: Array.from({ length: openaiCount }, () => loadingSlot),
    geminiResults: Array.from({ length: geminiCount }, () => loadingSlot),
    selections: [],
    commentary: null,
    startedAt: new Date().toISOString(),
    settledAt: null,
  };

  const priorRoundUpdated: Round = {
    ...priorRound,
    selections: input.selections,
    commentary: input.commentary,
  };
  await finalizeRound(priorRoundUpdated);

  await putRoundPlaceholder(round);
  await appendRoundToSession(input.sessionId, round.id);

  const openaiRefs = refs.blobs.map((blob, i) => {
    const result = getSelectedResult(priorRound, input.selections[i]);
    return { bytes: result.bytes, mimeType: result.mimeType };
  });
  const geminiRefs = refs.base64Parts.map((base64, i) => {
    const result = getSelectedResult(priorRound, input.selections[i]);
    return { base64, mimeType: result.mimeType };
  });

  return { round, priorRoundUpdated, openaiRefs, geminiRefs };
}

function getSelectedResult(
  round: Round,
  selection: { readonly provider: Provider; readonly index: number },
): { bytes: ArrayBuffer; mimeType: string } {
  const results = selection.provider === "openai"
    ? round.openaiResults
    : round.geminiResults;
  const r = results[selection.index];
  if (!r || r.status !== "success") {
    throw new Error(`Selection ${selection.provider}[${selection.index}] is not a success slot.`);
  }
  return { bytes: r.bytes, mimeType: r.mimeType };
}
