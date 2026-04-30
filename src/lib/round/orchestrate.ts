import type {
  ImageCount,
  AspectRatioConfig,
  Provider,
} from "@/lib/providers/types";
import type { Round, RoundResult } from "@/lib/storage/schema";
import { generateId } from "@/lib/storage/schema";
import {
  createSession,
  appendRoundToSession,
  putRoundPlaceholder,
} from "@/lib/storage/history";
import { getStorage } from "@/lib/storage/keys";
import { snapAspectIfNeeded } from "./aspect";

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
