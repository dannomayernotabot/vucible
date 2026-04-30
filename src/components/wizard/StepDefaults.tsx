"use client";

import { useWizard } from "./WizardContext";
import { WIZARD_COPY } from "@/lib/wizard/copy";
import { Button } from "@/components/ui/button";
import { ImageCountPicker } from "@/components/round/ImageCountPicker";
import { AspectRatioPicker } from "@/components/round/AspectRatioPicker";
import type { ImageCount, AspectRatioConfig } from "@/lib/providers/types";

export function StepDefaults() {
  const { state, dispatch } = useWizard();

  const imageCount: ImageCount = state.draftDefaults.imageCount ?? 8;
  const aspectRatio: AspectRatioConfig = state.draftDefaults.aspectRatio ?? {
    kind: "discrete",
    ratio: "1:1",
  };
  const geminiEnabled = state.draftProviders.gemini?.validatedAt !== undefined;

  const caps = Object.entries(state.draftProviders)
    .filter(([, d]) => d?.validatedAt !== undefined && d?.ipm !== undefined)
    .map(([key, d]) => ({
      ipm: d!.ipm!,
      label: key === "openai" ? "OpenAI" : "Gemini",
    }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{WIZARD_COPY.step3.header}</h2>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {WIZARD_COPY.step3.imageCount.label}
          </label>
          <ImageCountPicker
            value={imageCount}
            onChange={(count) =>
              dispatch({ type: "set-defaults", defaults: { imageCount: count } })
            }
            caps={caps}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {WIZARD_COPY.step3.aspectRatio.label}
          </label>
          <AspectRatioPicker
            geminiEnabled={geminiEnabled}
            value={aspectRatio}
            onChange={(ar) =>
              dispatch({ type: "set-defaults", defaults: { aspectRatio: ar } })
            }
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button
          variant="ghost"
          onClick={() => dispatch({ type: "set-step", step: 2 })}
        >
          Back
        </Button>
        <Button onClick={() => dispatch({ type: "set-step", step: 4 })}>
          {WIZARD_COPY.step3.cta} →
        </Button>
      </div>
    </div>
  );
}
