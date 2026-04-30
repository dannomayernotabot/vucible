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
import {
  fanOut,
  startRoundOne,
  type StartRoundInput,
  type SlotUpdate,
} from "@/lib/round/orchestrate";

interface RoundContextValue {
  readonly round: Round | null;
  readonly isRunning: boolean;
  readonly done: number;
  readonly total: number;
  readonly queued: number;
  readonly consecutive429Count: Record<Provider, number>;
  readonly startRound: (input: StartRoundInput) => void;
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
  const [queued, setQueued] = useState(0);
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

  const startRound = useCallback(
    (input: StartRoundInput) => {
      const controller = new AbortController();
      abortRef.current = controller;

      setConsecutive429({ openai: 0, gemini: 0 });

      startRoundOne(input).then(({ round: r, sessionId }) => {
        setRound(r);

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
      startRound,
      abortRound,
    }),
    [round, isRunning, done, total, queued, consecutive429, startRound, abortRound],
  );

  return (
    <RoundContext.Provider value={value}>{children}</RoundContext.Provider>
  );
}
