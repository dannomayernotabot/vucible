"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "./TopBar";
import { ThemeProvider } from "./ThemeProvider";
import { HistoryRail } from "@/components/history/HistoryRail";
import { findOrphanRounds, markRoundOrphaned } from "@/lib/storage/history";

interface AppShellProps {
  readonly children?: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  const toggleHistory = useCallback(() => {
    setHistoryOpen((prev) => !prev);
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
      <div className="flex min-h-screen flex-col">
        <TopBar onToggleHistory={toggleHistory} />
        <div className="flex flex-1 overflow-hidden">
          <HistoryRail open={historyOpen} onClose={() => setHistoryOpen(false)} />
          <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
        </div>
      </div>
    </ThemeProvider>
  );
}
