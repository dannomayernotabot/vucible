"use client";

import { useReducer, useEffect, useRef, useCallback, Fragment } from "react";
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

const STEP_COUNT = 4;

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Wizard progress" className="flex items-center gap-0">
      {Array.from({ length: STEP_COUNT }, (_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <Fragment key={step}>
            {i > 0 && (
              <div
                className="h-px w-8 sm:w-12 transition-colors"
                style={{
                  backgroundColor: done
                    ? "var(--primary)"
                    : "var(--border)",
                  transitionDuration: "var(--duration-base)",
                }}
              />
            )}
            <div
              aria-current={active ? "step" : undefined}
              className="rounded-full transition-all"
              style={{
                width: active ? 10 : 8,
                height: active ? 10 : 8,
                backgroundColor: done || active
                  ? "var(--primary)"
                  : "var(--border)",
                boxShadow: active
                  ? "0 0 0 4px var(--brand-100)"
                  : "none",
                transitionDuration: "var(--duration-base)",
              }}
            />
          </Fragment>
        );
      })}
    </nav>
  );
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
        <div className="wizard-backdrop flex min-h-screen flex-col">
          <div className="flex flex-col items-center pt-10 md:pt-14">
            <span className="mb-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Vucible
            </span>
            <StepIndicator current={state.step} />
            <span className="sr-only">{stepLabel}</span>
          </div>

          <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
            <div className="w-full max-w-xl animate-fade-in-up">
              {state.step === 1 && <StepIntro />}
              {state.step === 2 && <StepKeys />}
              {state.step === 3 && <StepDefaults />}
              {state.step === 4 && <StepConfirm />}
            </div>
          </div>
        </div>
      </WizardContext>
    </WizardErrorBoundary>
  );
}
