"use client";

import { useCallback, useState } from "react";
import { useRound } from "@/components/round/RoundProvider";
import type { Provider } from "@/lib/providers/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const THRESHOLD = 3;

const PROVIDER_COPY: Record<Provider, string> = {
  openai:
    "Hit your OpenAI rate limit. Lower the per-round image count or upgrade your OpenAI tier.",
  gemini:
    "Hit your Gemini rate limit. Lower the per-round image count or wait for the quota to reset.",
};

export function RateLimitBanner() {
  const { consecutive429Count } = useRound();
  const [dismissed, setDismissed] = useState<ReadonlySet<Provider>>(new Set());

  const handleDismiss = useCallback((provider: Provider) => {
    setDismissed((prev) => new Set([...prev, provider]));
  }, []);

  const providers: Provider[] = ["openai", "gemini"];
  const active = providers.filter(
    (p) => consecutive429Count[p] >= THRESHOLD && !dismissed.has(p),
  );

  if (active.length === 0) return null;

  return (
    <div className="space-y-2">
      {active.map((provider) => (
        <Alert key={provider} variant="destructive">
          <AlertTitle>Rate limited</AlertTitle>
          <AlertDescription className="flex items-start justify-between gap-2">
            <span>{PROVIDER_COPY[provider]}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDismiss(provider)}
              aria-label={`Dismiss ${provider} rate limit warning`}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
