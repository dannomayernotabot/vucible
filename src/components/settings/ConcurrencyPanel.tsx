"use client";

import { useState } from "react";
import { getStorage, setStorage } from "@/lib/storage/keys";
import { Input } from "@/components/ui/input";
import type { Provider } from "@/lib/providers/types";

const LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
};

export function ConcurrencyPanel() {
  const storage = getStorage();
  const providers = storage?.providers ?? {};
  const entries = Object.entries(providers).filter(([, c]) => c !== undefined);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No providers configured.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Concurrency cap limits how many images generate in parallel per
        provider. Cannot exceed your tier's rate limit.
      </p>
      {entries.map(([key, config]) => (
        <ConcurrencyRow
          key={key}
          provider={key as Provider}
          ipm={config!.ipm}
          cap={config!.concurrencyCap}
        />
      ))}
    </div>
  );
}

function ConcurrencyRow({
  provider,
  ipm,
  cap,
}: {
  provider: Provider;
  ipm: number;
  cap: number;
}) {
  const [value, setValue] = useState(cap);
  const overCap = value > ipm;

  function handleBlur() {
    const clamped = Math.max(1, Math.min(value, ipm));
    setValue(clamped);
    const current = getStorage();
    if (!current) return;
    const providerConfig = current.providers[provider];
    if (!providerConfig) return;
    setStorage({
      ...current,
      providers: {
        ...current.providers,
        [provider]: { ...providerConfig, concurrencyCap: clamped },
      },
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{LABELS[provider]}</label>
        <span className="text-xs text-muted-foreground">
          max {ipm}/min
        </span>
      </div>
      <Input
        type="number"
        min={1}
        max={ipm}
        value={value}
        onChange={(e) => setValue(parseInt(e.target.value, 10) || 1)}
        onBlur={handleBlur}
        className="w-20"
        aria-label={`${LABELS[provider]} concurrency cap`}
      />
      {overCap && (
        <p className="text-xs text-destructive">
          Exceeds your {LABELS[provider]} rate limit of {ipm}/min. Will be
          clamped on save.
        </p>
      )}
    </div>
  );
}
