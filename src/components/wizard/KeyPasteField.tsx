"use client";

import { useRef, useCallback, useEffect } from "react";
import type { Provider } from "@/lib/providers/types";
import { useWizard } from "./WizardContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isPlausibleOpenAIKey, isPlausibleGeminiKey } from "@/lib/wizard/validation";
import { testGenerate as openaiTestGenerate } from "@/lib/providers/openai";
import { listModels as geminiListModels } from "@/lib/providers/gemini";
import { defaultIpm } from "@/lib/providers/tiers";
import { WIZARD_COPY } from "@/lib/wizard/copy";

const PLAUSIBILITY: Record<Provider, (s: string) => boolean> = {
  openai: isPlausibleOpenAIKey,
  gemini: isPlausibleGeminiKey,
};

interface KeyPasteFieldProps {
  readonly provider: Provider;
}

export function KeyPasteField({ provider }: KeyPasteFieldProps) {
  const { state, dispatch } = useWizard();
  const draft = state.draftProviders[provider];
  const copy = WIZARD_COPY.step2[provider];
  const abortRef = useRef<AbortController | null>(null);

  const apiKey = draft?.apiKey ?? "";
  const isValidating = draft?.validating === true;
  const isValidated = draft?.validatedAt !== undefined && draft?.validatedAt !== null;
  const isPlausible = PLAUSIBILITY[provider](apiKey);

  const handleValidate = useCallback(async () => {
    if (isValidating) return;

    dispatch({ type: "validate-start", provider });

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const trimmedKey = apiKey.trim();

    if (provider === "openai") {
      const result = await openaiTestGenerate(trimmedKey);
      if (controller.signal.aborted) return;
      if (result.ok) {
        dispatch({ type: "validate-success", provider, tier: result.tier, ipm: result.ipm });
      } else {
        dispatch({ type: "validate-error", provider, error: result.error });
      }
    } else {
      const result = await geminiListModels(trimmedKey);
      if (controller.signal.aborted) return;
      if (result.ok) {
        const tier = "tier1" as const;
        dispatch({ type: "validate-success", provider, tier, ipm: defaultIpm(tier) });
      } else {
        dispatch({ type: "validate-error", provider, error: result.error });
      }
    }
  }, [apiKey, dispatch, isValidating, provider]);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "clear-provider", provider });
  }, [dispatch, provider]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div className="flex gap-2">
      <Input
        type="password"
        placeholder={copy.placeholder}
        value={apiKey}
        onChange={(e) =>
          dispatch({ type: "set-draft-key", provider, apiKey: e.target.value })
        }
        readOnly={isValidating || isValidated}
        aria-label={copy.label}
      />
      {isValidated ? (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          Clear
        </Button>
      ) : (
        <Button
          onClick={handleValidate}
          disabled={!isPlausible || isValidating}
          size="sm"
        >
          {isValidating ? copy.validatingLabel : copy.validateLabel}
        </Button>
      )}
    </div>
  );
}
