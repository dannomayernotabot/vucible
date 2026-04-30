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
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{WIZARD_COPY.step4.header}</h2>
      <p className="text-muted-foreground">{WIZARD_COPY.step4.body}</p>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h3 className="mb-2 text-sm font-medium">Providers</h3>
            <div className="space-y-2">
              {validProviders.map(([key, draft]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">
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

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Images per round</span>
            <span className="text-sm">{imageCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Aspect ratio</span>
            <span className="text-sm">
              {aspectRatio.kind === "discrete"
                ? aspectRatio.ratio
                : `${aspectRatio.width}×${aspectRatio.height}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {hasGeminiFree && <FreeTierWarning />}

      <div className="flex justify-between">
        <Button
          variant="ghost"
          onClick={() => dispatch({ type: "set-step", step: 3 })}
        >
          Back
        </Button>
        <Button
          size="lg"
          onClick={() => dispatch({ type: "complete" })}
        >
          {WIZARD_COPY.step4.cta} →
        </Button>
      </div>
    </div>
  );
}
