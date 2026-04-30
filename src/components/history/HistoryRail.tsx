"use client";

import { useCallback, useEffect, useState } from "react";
import { useRound } from "@/components/round/RoundProvider";
import { listRoundsBySession } from "@/lib/storage/history";
import type { Round } from "@/lib/storage/schema";
import { RoundCard } from "./RoundCard";

interface HistoryRailProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function HistoryRail({ open, onClose }: HistoryRailProps) {
  const { round: activeRound } = useRound();
  const [rounds, setRounds] = useState<Round[]>([]);

  const sessionId = activeRound?.sessionId;

  useEffect(() => {
    if (!sessionId || !open) {
      setRounds([]);
      return;
    }
    listRoundsBySession(sessionId).then(setRounds);
  }, [sessionId, open, activeRound?.settledAt]);

  if (!open) return null;

  return (
    <aside
      className="animate-in slide-in-from-left duration-200 flex h-full w-64 shrink-0 flex-col border-r bg-background motion-reduce:animate-none"
      aria-label="Round history"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-sm font-medium">History</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close history"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {rounds.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No rounds yet
          </p>
        ) : (
          <div className="space-y-2">
            {rounds.map((r) => (
              <RoundCard
                key={r.id}
                round={r}
                isActive={activeRound?.id === r.id}
                onClick={() => {}}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
