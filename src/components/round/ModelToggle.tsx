"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Provider } from "@/lib/providers/types";
import { getStorage } from "@/lib/storage/keys";

interface ModelToggleProps {
  readonly provider: Provider;
  readonly enabled: boolean;
  readonly onToggle: () => void;
  readonly disabled?: boolean;
}

const LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
};

export function ModelToggle({
  provider,
  enabled,
  onToggle,
  disabled = false,
}: ModelToggleProps) {
  const storage = getStorage();
  const hasKey = !!storage?.providers[provider];

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={provider + "-toggle"}
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={disabled || !hasKey}
        aria-label={"Toggle " + LABELS[provider]}
      />
      <Label
        htmlFor={provider + "-toggle"}
        className={hasKey ? "" : "text-muted-foreground"}
      >
        {LABELS[provider]}
        {!hasKey && " (no key)"}
      </Label>
    </div>
  );
}
