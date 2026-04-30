"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Round, RoundResult } from "@/lib/storage/schema";
import type { Provider } from "@/lib/providers/types";
import { ProviderThrottle } from "@/lib/round/throttle";
import type { ImageCount, AspectRatioConfig } from "@/lib/providers/types";
import {
  fanOut,
  startRoundOne,
  startRoundN,
  type StartRoundInput,
  type SlotUpdate,
} from "@/lib/round/orchestrate";

export interface Selection {
  readonly provider: Provider;
  readonly index: number;
}

export const MAX_SELECTIONS = 4;

interface RoundContextValue {
  readonly round: Round | null;
  readonly isRunning: boolean;
  readonly done: number;
  readonly total: number;
  readonly queued: number;
  readonly consecutive429Count: Record<Provider, number>;
  readonly selections: readonly Selection[];
  readonly commentary: string;
  readonly sessionId: string | null;
  readonly toggleSelection: (provider: Provider, index: number) => void;
  readonly setCommentary: (value: string) => void;
  readonly startRound: (input: StartRoundInput) => void;
  readonly evolveRound: (input: {
    modelsEnabled: { openai: boolean; gemini: boolean };
    count: ImageCount;
    aspect: AspectRatioConfig;
  }) => void;
  readonly abortRound: () => void;
}

const RoundContext = createContext<RoundContextValue | null>(null);

export function useRound(): RoundContextValue {
  const ctx = useContext(RoundContext);
  if (!ctx) throw new Error("useRound must be used within RoundProvider");
  return ctx;
}

function countTerminal(results: readonly RoundResult[]): number {
  return results.filter((r) => r.status !== "loading").length;
}

interface RoundProviderProps {
  readonly children: React.ReactNode;
  readonly openaiCap?: number;
  readonly geminiCap?: number;
}

export function RoundProvider({
  children,
  openaiCap = 5,
  geminiCap = 5,
}: RoundProviderProps) {
  const [round, setRound] = useState<Round | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [queued, setQueued] = useState(0);
  const [selections, setSelections] = useState<readonly Selection[]>([]);
  const [commentary, setCommentary] = useState("");
  const [consecutive429, setConsecutive429] = useState<Record<Provider, number>>({
    openai: 0,
    gemini: 0,
  });

  const abortRef = useRef<AbortController | null>(null);
  const throttlesRef = useRef({
    openai: new ProviderThrottle(openaiCap),
    gemini: new ProviderThrottle(geminiCap),
  });

  useEffect(() => {
    throttlesRef.current.openai.setCap(openaiCap);
  }, [openaiCap]);

  useEffect(() => {
    throttlesRef.current.gemini.setCap(geminiCap);
  }, [geminiCap]);

  useEffect(() => {
    const update = () => {
      setQueued(
        throttlesRef.current.openai.queued() +
          throttlesRef.current.gemini.queued(),
      );
    };
    const { openai, gemini } = throttlesRef.current;
    openai.addEventListener("change", update);
    gemini.addEventListener("change", update);
    return () => {
      openai.removeEventListener("change", update);
      gemini.removeEventListener("change", update);
    };
  }, []);

  const handleSlotUpdate = useCallback((update: SlotUpdate) => {
    setRound((prev) => {
      if (!prev) return prev;
      const key = update.provider === "openai" ? "openaiResults" : "geminiResults";
      const results = [...prev[key]];
      results[update.index] = update.result;
      return { ...prev, [key]: results };
    });

    if (update.result.status === "error" && update.result.error.kind === "rate_limited") {
      setConsecutive429((prev) => ({
        ...prev,
        [update.provider]: prev[update.provider] + 1,
      }));
    } else if (update.result.status !== "loading") {
      setConsecutive429((prev) => ({
        ...prev,
        [update.provider]: 0,
      }));
    }
  }, []);

  const toggleSelection = useCallback(
    (provider: Provider, index: number) => {
      setSelections((prev) => {
        const existing = prev.findIndex(
          (s) => s.provider === provider && s.index === index,
        );
        if (existing >= 0) {
          return prev.filter((_, i) => i !== existing);
        }
        if (prev.length >= MAX_SELECTIONS) {
          return prev;
        }
        return [...prev, { provider, index }];
      });
    },
    [],
  );

  const startRound = useCallback(
    (input: StartRoundInput) => {
      const controller = new AbortController();
      abortRef.current = controller;

      setSelections([]);
      setCommentary("");
      setConsecutive429({ openai: 0, gemini: 0 });

      startRoundOne(input).then(({ round: r, sessionId: sid }) => {
        setRound(r);
        setSessionId(sid);

        fanOut({
          round: r,
          signal: controller.signal,
          throttles: throttlesRef.current,
          onSlotUpdate: handleSlotUpdate,
        }).then((settled) => {
          setRound(settled);
          abortRef.current = null;
        });
      });
    },
    [handleSlotUpdate],
  );

  const evolveRound = useCallback(
    (input: {
      modelsEnabled: { openai: boolean; gemini: boolean };
      count: ImageCount;
      aspect: AspectRatioConfig;
    }) => {
      if (!round || !sessionId) return;

      const controller = new AbortController();
      abortRef.current = controller;

      const currentSelections = [...selections];
      const currentCommentary = commentary || null;

      setSelections([]);
      setCommentary("");
      setConsecutive429({ openai: 0, gemini: 0 });

      startRoundN({
        sessionId,
        priorRoundId: round.id,
        selections: currentSelections,
        commentary: currentCommentary,
        modelsEnabled: input.modelsEnabled,
        count: input.count,
        aspect: input.aspect,
      }).then(({ round: newRound, openaiRefs, geminiRefs }) => {
        setRound(newRound);

        fanOut({
          round: newRound,
          signal: controller.signal,
          throttles: throttlesRef.current,
          onSlotUpdate: handleSlotUpdate,
          openaiRefs,
          geminiRefs,
        }).then((settled) => {
          setRound(settled);
          abortRef.current = null;
        });
      });
    },
    [round, sessionId, selections, commentary, handleSlotUpdate],
  );

  const abortRound = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const done = round
    ? countTerminal(round.openaiResults) + countTerminal(round.geminiResults)
    : 0;
  const total = round
    ? round.openaiResults.length + round.geminiResults.length
    : 0;
  const isRunning = round !== null && round.settledAt === null;

  const value = useMemo<RoundContextValue>(
    () => ({
      round,
      isRunning,
      done,
      total,
      queued,
      consecutive429Count: consecutive429,
      selections,
      commentary,
      sessionId,
      toggleSelection,
      setCommentary,
      startRound,
      evolveRound,
      abortRound,
    }),
    [round, isRunning, done, total, queued, consecutive429, selections, commentary, sessionId, toggleSelection, setCommentary, startRound, evolveRound, abortRound],
  );

  return (
    <RoundContext.Provider value={value}>{children}</RoundContext.Provider>
  );
}
