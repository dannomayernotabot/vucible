"use client";

import { useEffect, useState } from "react";
import { Check, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listImageModels } from "@/lib/providers/openai";
import { cn } from "@/lib/utils";

const MODEL_DESCRIPTIONS: Record<string, string> = {
  "gpt-image-1": "Standard quality",
  "gpt-image-1.5": "Higher quality",
  "gpt-image-1-mini": "Faster, lower cost",
  "gpt-image-2": "Newest model",
  "gpt-image-2-2026-04-21": "Newest (dated snapshot)",
  "chatgpt-image-latest": "ChatGPT-style output",
  "dall-e-3": "Legacy DALL-E 3",
  "dall-e-2": "Legacy DALL-E 2",
};

function isGated(model: string): boolean {
  return model.startsWith("gpt-image-2") || model.startsWith("chatgpt-image-");
}

interface OpenaiModelPickerProps {
  readonly apiKey: string;
  readonly selected: string;
  readonly onSelect: (model: string) => void;
}

export function OpenaiModelPicker({
  apiKey,
  selected,
  onSelect,
}: OpenaiModelPickerProps) {
  const [models, setModels] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listImageModels(apiKey).then((result) => {
      if (cancelled) return;
      if (result.ok && result.models.length > 0) {
        setModels(result.models);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  if (loading) {
    return (
      <div className="space-y-2 py-1" aria-label="Loading models">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (!models) return null;

  const ungated = models.filter((m) => !isGated(m));
  const gated = models.filter(isGated);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Image model</label>
      <div
        className="space-y-1.5"
        role="radiogroup"
        aria-label="OpenAI image model"
      >
        {ungated.map((model) => (
          <ModelOption
            key={model}
            model={model}
            selected={selected === model}
            onSelect={onSelect}
          />
        ))}
        {gated.length > 0 && (
          <>
            <div className="flex items-center gap-2 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                Requires org verification
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {gated.map((model) => (
              <ModelOption
                key={model}
                model={model}
                gated
                selected={selected === model}
                onSelect={onSelect}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ModelOption({
  model,
  selected,
  gated,
  onSelect,
}: {
  model: string;
  selected: boolean;
  gated?: boolean;
  onSelect: (model: string) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={model}
      onClick={() => onSelect(model)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
      )}
    >
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30",
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="text-sm font-medium">{model}</code>
          {gated && (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
            >
              <ShieldAlert data-icon="inline-start" className="h-3 w-3" />
              Verification required
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {MODEL_DESCRIPTIONS[model] ?? model}
        </p>
      </div>
    </button>
  );
}
