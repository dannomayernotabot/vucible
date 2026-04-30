"use client";

import { useReducer, useEffect, useRef, useCallback } from "react";
import { wizardReducer, initialState } from "@/lib/wizard/machine";
import type { WizardAction } from "@/lib/wizard/machine";
import { getProgress, setProgress, clearProgress } from "@/lib/storage/wizard-progress";
import { setStorage } from "@/lib/storage/keys";
import type { VucibleStorageV1, ProviderConfig } from "@/lib/providers/types";
import { WizardContext } from "./WizardContext";
import { StepIntro } from "./StepIntro";
import { StepKeys } from "./StepKeys";
import { StepDefaults } from "./StepDefaults";
import { StepConfirm } from "./StepConfirm";
import { WizardErrorBoundary } from "./WizardErrorBoundary";

interface WizardShellProps {
  onComplete: () => void;
}

export function WizardShell({ onComplete }: WizardShellProps) {
  const [state, rawDispatch] = useReducer(
    wizardReducer,
    null,
    () => initialState(getProgress()),
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dispatch = useCallback(
    (action: WizardAction) => {
      rawDispatch(action);
    },
    [],
  );

  useEffect(() => {
    if (state.completed) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setProgress({
        step: state.step,
        draftProviders: state.draftProviders,
        draftDefaults:
          Object.keys(state.draftDefaults).length > 0
            ? state.draftDefaults
            : undefined,
      });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state.step, state.draftProviders, state.draftDefaults, state.completed]);

  useEffect(() => {
    if (!state.completed) return;

    const providers: Partial<Record<"openai" | "gemini", ProviderConfig>> = {};
    for (const [key, draft] of Object.entries(state.draftProviders)) {
      const provider = key as "openai" | "gemini";
      if (draft?.apiKey && draft.tier && draft.ipm && draft.validatedAt) {
        providers[provider] = {
          apiKey: draft.apiKey,
          tier: draft.tier,
          ipm: draft.ipm,
          concurrencyCap: draft.ipm,
          validatedAt: draft.validatedAt,
        };
      }
    }

    const storage: VucibleStorageV1 = {
      schemaVersion: 1,
      providers,
      defaults: {
        imageCount: state.draftDefaults.imageCount ?? 8,
        aspectRatio: state.draftDefaults.aspectRatio ?? {
          kind: "discrete",
          ratio: "1:1",
        },
        theme: state.draftDefaults.theme ?? "system",
      },
      createdAt: new Date().toISOString(),
    };

    setStorage(storage);
    clearProgress();
    onComplete();
  }, [state.completed, state.draftProviders, state.draftDefaults, onComplete]);

  const stepLabel = `Step ${state.step} of 4`;

  return (
    <WizardErrorBoundary>
      <WizardContext value={{ state, dispatch }}>
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center p-6">
          <p className="mb-4 text-sm text-muted-foreground">{stepLabel}</p>
          <div className="w-full">
            {state.step === 1 && <StepIntro />}
            {state.step === 2 && <StepKeys />}
            {state.step === 3 && <StepDefaults />}
            {state.step === 4 && <StepConfirm />}
          </div>
        </div>
      </WizardContext>
    </WizardErrorBoundary>
  );
}


