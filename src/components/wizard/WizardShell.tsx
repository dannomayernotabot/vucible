"use client";

import { useReducer, useEffect, useRef, useCallback } from "react";
import { wizardReducer, initialState } from "@/lib/wizard/machine";
import type { WizardAction } from "@/lib/wizard/machine";
import { getProgress, setProgress, clearProgress } from "@/lib/storage/wizard-progress";
import { setStorage } from "@/lib/storage/keys";
import type { VucibleStorageV1, ProviderConfig } from "@/lib/providers/types";
import { WizardContext, useWizard } from "./WizardContext";

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
    <WizardContext value={{ state, dispatch }}>
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center p-6">
        <p className="mb-4 text-sm text-muted-foreground">{stepLabel}</p>
        <div className="w-full">
          {state.step === 1 && <StepPlaceholder step={1} />}
          {state.step === 2 && <StepPlaceholder step={2} />}
          {state.step === 3 && <StepPlaceholder step={3} />}
          {state.step === 4 && <StepPlaceholder step={4} />}
        </div>
      </div>
    </WizardContext>
  );
}

function StepPlaceholder({ step }: { step: number }) {
  const { dispatch } = useWizard();
  return (
    <div className="rounded-lg border p-6 text-center">
      <p className="text-lg font-semibold">Step {step}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Content coming in a later bead.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        {step > 1 && (
          <button
            className="rounded bg-secondary px-4 py-2 text-sm"
            onClick={() =>
              dispatch({
                type: "set-step",
                step: (step - 1) as 1 | 2 | 3 | 4,
              })
            }
          >
            Back
          </button>
        )}
        {step < 4 ? (
          <button
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() =>
              dispatch({
                type: "set-step",
                step: (step + 1) as 1 | 2 | 3 | 4,
              })
            }
          >
            Next
          </button>
        ) : (
          <button
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => dispatch({ type: "complete" })}
          >
            Complete
          </button>
        )}
      </div>
    </div>
  );
}

