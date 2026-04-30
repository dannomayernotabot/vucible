"use client";

import { useCallback, useEffect, useState } from "react";
import { useRound } from "@/components/round/RoundProvider";
import { listRoundsBySession } from "@/lib/storage/history";
import type { Round } from "@/lib/storage/schema";
import { RoundCard } from "./RoundCard";
import { SessionsList } from "./SessionsList";
import { ScrollBackPanel } from "./ScrollBackPanel";

interface HistoryRailProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onViewRound?: (roundId: string | null) => void;
}

type View = "rounds" | "sessions";

export function HistoryRail({ open, onClose, onViewRound }: HistoryRailProps) {
  const { round: activeRound } = useRound();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [view, setView] = useState<View>("rounds");
  const [viewedSessionId, setViewedSessionId] = useState<string | undefined>();
  const [viewedRoundId, setViewedRoundId] = useState<string | null>(null);

  const sessionId = viewedSessionId ?? activeRound?.sessionId;

  useEffect(() => {
    if (!sessionId || !open) {
      setRounds([]);
      return;
    }
    listRoundsBySession(sessionId).then(setRounds);
  }, [sessionId, open, activeRound?.settledAt]);

  useEffect(() => {
    if (!open) {
      setView("rounds");
      setViewedSessionId(undefined);
      setViewedRoundId(null);
      onViewRound?.(null);
    }
  }, [open, onViewRound]);

  const handleSelectSession = useCallback((id: string) => {
    setViewedSessionId(id);
    setView("rounds");
  }, []);

  const handleBackToRounds = useCallback(() => {
    setView("rounds");
  }, []);

  if (!open) return null;

  return (
    <aside
      className="animate-in slide-in-from-left duration-200 flex h-full w-64 shrink-0 flex-col border-r bg-background motion-reduce:animate-none"
      aria-label="Round history"
    >
      {view === "sessions" ? (
        <SessionsList
          activeSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onBack={handleBackToRounds}
        />
      ) : (
        <>
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-sm font-medium">History</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setView("sessions")}
                className="text-xs text-muted-foreground hover:text-foreground"
                aria-label="View all sessions"
              >
                Sessions →
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close history"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {viewedSessionId && viewedSessionId !== activeRound?.sessionId && (
              <button
                type="button"
                onClick={() => setViewedSessionId(undefined)}
                className="mb-2 w-full text-left text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back to current session
              </button>
            )}
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
                    isViewed={viewedRoundId === r.id}
                    onClick={() => {
                      const newId = viewedRoundId === r.id ? null : r.id;
                      setViewedRoundId(newId);
                      onViewRound?.(newId);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
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
