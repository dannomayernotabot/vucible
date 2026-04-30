"use client";

import { useEffect, useState } from "react";
import type { Session } from "@/lib/storage/schema";
import { listSessions } from "@/lib/storage/history";

interface SessionsListProps {
  readonly activeSessionId: string | undefined;
  readonly onSelectSession: (sessionId: string) => void;
  readonly onBack: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncatePrompt(prompt: string, max = 60): string {
  if (prompt.length <= max) return prompt;
  return prompt.slice(0, max - 1) + "…";
}

export function SessionsList({
  activeSessionId,
  onSelectSession,
  onBack,
}: SessionsListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    listSessions(50).then(setSessions);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Back to rounds"
        >
          <BackIcon />
        </button>
        <h3 className="text-sm font-medium">Sessions</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No sessions yet
          </p>
        ) : (
          <div className="space-y-1">
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSession(s.id)}
                className={`w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent ${
                  s.id === activeSessionId
                    ? "bg-accent font-medium"
                    : ""
                }`}
                aria-current={s.id === activeSessionId ? "true" : undefined}
              >
                <p className="truncate text-sm">
                  {truncatePrompt(s.originalPrompt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(s.startedAt)}
                  {" · "}
                  {s.roundIds.length} round{s.roundIds.length !== 1 ? "s" : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BackIcon() {
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
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
