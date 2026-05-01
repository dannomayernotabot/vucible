"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "./TopBar";
import { ThemeProvider } from "./ThemeProvider";
import { HistoryRail } from "@/components/history/HistoryRail";
import { HistoryErrorBoundary } from "@/components/history/HistoryErrorBoundary";
import { ScrollBackPanel } from "@/components/history/ScrollBackPanel";
import { RoundErrorBoundary } from "@/components/round/RoundErrorBoundary";
import { findOrphanRounds, markRoundOrphaned } from "@/lib/storage/history";

interface AppShellProps {
  readonly children?: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewedRoundId, setViewedRoundId] = useState<string | null>(null);

  const toggleHistory = useCallback(() => {
    setHistoryOpen((prev) => !prev);
  }, []);

  const handleViewRound = useCallback((roundId: string | null) => {
    setViewedRoundId(roundId);
  }, []);

  useEffect(() => {
    findOrphanRounds().then((orphans) => {
      for (const round of orphans) {
        markRoundOrphaned(
          round,
          "Round interrupted (refresh or tab close).",
        );
      }
    });
  }, []);

  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <TopBar onToggleHistory={toggleHistory} />
        <div className="flex flex-1 overflow-hidden">
          <HistoryErrorBoundary>
            <HistoryRail
              open={historyOpen}
              onClose={() => setHistoryOpen(false)}
              onViewRound={handleViewRound}
            />
          </HistoryErrorBoundary>
          <main className="flex flex-1 flex-col overflow-y-auto">
            <RoundErrorBoundary>
              {viewedRoundId ? (
                <ScrollBackPanel
                  roundId={viewedRoundId}
                  onClose={() => setViewedRoundId(null)}
                />
              ) : (
                children
              )}
            </RoundErrorBoundary>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
