"use client";

import { useWizard } from "./WizardContext";
import { WIZARD_COPY } from "@/lib/wizard/copy";
import { Button } from "@/components/ui/button";
import { ProviderCard } from "./ProviderCard";
import { RecommendBlend } from "./RecommendBlend";

export function StepKeys() {
  const { state, dispatch } = useWizard();

  const hasValidated =
    state.draftProviders.openai?.validatedAt !== undefined ||
    state.draftProviders.gemini?.validatedAt !== undefined;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{WIZARD_COPY.step2.header}</h2>
      <RecommendBlend />
      <div className="space-y-4">
        <ProviderCard provider="openai" />
        <ProviderCard provider="gemini" />
      </div>
      <div className="flex justify-between">
        <Button
          variant="ghost"
          onClick={() => dispatch({ type: "set-step", step: 1 })}
        >
          Back
        </Button>
        <Button
          disabled={!hasValidated}
          onClick={() => dispatch({ type: "set-step", step: 3 })}
        >
          {WIZARD_COPY.step2.cta} →
        </Button>
      </div>
    </div>
  );
}
