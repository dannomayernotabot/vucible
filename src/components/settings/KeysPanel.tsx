"use client";

import { getStorage, clearStorage } from "@/lib/storage/keys";
import { Button } from "@/components/ui/button";
import { CostDisclosure } from "@/components/wizard/CostDisclosure";
import type { Provider } from "@/lib/providers/types";

const LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
};

export function KeysPanel() {
  const storage = getStorage();
  const providers = storage?.providers ?? {};
  const entries = Object.entries(providers).filter(([, c]) => c !== undefined);

  return (
    <div className="space-y-4">
      {entries.length > 0 ? (
        entries.map(([key, config]) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div>
              <span className="text-sm font-medium">
                {LABELS[key as Provider]}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {config!.tier} — {config!.ipm} images/min
              </span>
            </div>
            <span className="text-xs text-green-600">Connected</span>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No providers configured.</p>
      )}
      <CostDisclosure />
      <p className="text-xs text-muted-foreground">
        To change keys, clear storage and re-run the setup wizard.
      </p>
    </div>
  );
}
