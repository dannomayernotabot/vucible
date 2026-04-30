"use client";

import type { Provider } from "@/lib/providers/types";
import { useWizard } from "./WizardContext";
import { TierBadge } from "./TierBadge";
import { TierDropdown } from "./TierDropdown";
import { FreeTierWarning } from "./FreeTierWarning";
import { errorToMessage } from "@/lib/round/failures";
import { defaultIpm } from "@/lib/providers/tiers";
import { WIZARD_COPY } from "@/lib/wizard/copy";

interface ValidationStatusProps {
  readonly provider: Provider;
}

export function ValidationStatus({ provider }: ValidationStatusProps) {
  const { state, dispatch } = useWizard();
  const draft = state.draftProviders[provider];

  if (!draft) return null;

  if (draft.validating) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        <span>
          {provider === "openai" ? "Generating test image…" : "Checking…"}
        </span>
      </div>
    );
  }

  if (draft.error) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
      >
        {errorToMessage(draft.error, "wizard")}
      </div>
    );
  }

  if (draft.validatedAt && draft.tier) {
    if (provider === "openai") {
      return <TierBadge tier={draft.tier} ipm={draft.ipm ?? 0} />;
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-green-600">{"✓"}</span>
          <span>{WIZARD_COPY.step2.gemini.successLabel}</span>
        </div>
        <TierDropdown
          value={draft.tier}
          onChange={(tier) => {
            dispatch({
              type: "validate-success",
              provider: "gemini",
              tier,
              ipm: defaultIpm(tier),
            });
          }}
        />
        {draft.tier === "free" && <FreeTierWarning />}
      </div>
    );
  }

  return null;
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
