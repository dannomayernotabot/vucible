"use client";

import { useWizard } from "./WizardContext";
import { WIZARD_COPY } from "@/lib/wizard/copy";
import { Button } from "@/components/ui/button";
import { TierBadge } from "./TierBadge";
import { FreeTierWarning } from "./FreeTierWarning";
import { Card, CardContent } from "@/components/ui/card";
import type { Provider } from "@/lib/providers/types";

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
};

export function StepConfirm() {
  const { state, dispatch } = useWizard();

  const imageCount = state.draftDefaults.imageCount ?? 8;
  const aspectRatio = state.draftDefaults.aspectRatio ?? {
    kind: "discrete" as const,
    ratio: "1:1" as const,
  };

  const validProviders = Object.entries(state.draftProviders).filter(
    ([, d]) => d?.validatedAt !== undefined,
  );

  const hasGeminiFree = state.draftProviders.gemini?.tier === "free";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {WIZARD_COPY.step4.header}
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          {WIZARD_COPY.step4.body}
        </p>
      </div>

      <Card className="shadow-[var(--shadow-md)]">
        <CardContent className="space-y-5 p-6">
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Providers
            </h3>
            <div className="space-y-2.5">
              {validProviders.map(([key, draft]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {PROVIDER_LABELS[key as Provider]}
                  </span>
                  <TierBadge
                    tier={draft!.tier!}
                    ipm={draft!.ipm ?? 0}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Images per round</span>
            <span className="text-sm tabular-nums">{imageCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Aspect ratio</span>
            <span className="text-sm tabular-nums">
              {aspectRatio.kind === "discrete"
                ? aspectRatio.ratio
                : `${aspectRatio.width}×${aspectRatio.height}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {hasGeminiFree && <FreeTierWarning />}

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          className="h-11 px-5"
          onClick={() => dispatch({ type: "set-step", step: 3 })}
        >
          Back
        </Button>
        <Button
          className="h-12 px-8 text-base font-medium"
          onClick={() => dispatch({ type: "complete" })}
        >
          {WIZARD_COPY.step4.cta} &rarr;
        </Button>
      </div>
    </div>
  );
}
