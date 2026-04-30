"use client";

import { useEffect } from "react";
import { TopBar } from "./TopBar";
import { ThemeProvider } from "./ThemeProvider";
import { findOrphanRounds, markRoundOrphaned } from "@/lib/storage/history";

interface AppShellProps {
  readonly children?: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
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
        <TopBar />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </ThemeProvider>
  );
}
