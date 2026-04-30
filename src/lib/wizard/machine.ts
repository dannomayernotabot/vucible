import type { Provider, Tier, AspectRatioConfig, ImageCount } from "@/lib/providers/types";
import type { NormalizedError } from "@/lib/providers/errors";

export type DraftProviderState =
  | { readonly phase: "idle" }
  | { readonly phase: "editing"; readonly apiKey: string }
  | { readonly phase: "validating"; readonly apiKey: string }
  | {
      readonly phase: "validated";
      readonly apiKey: string;
      readonly tier: Tier;
      readonly ipm: number;
    }
  | {
      readonly phase: "error";
      readonly apiKey: string;
      readonly error: NormalizedError;
    };

export interface WizardState {
  readonly step: 1 | 2 | 3 | 4;
  readonly providers: Record<Provider, DraftProviderState>;
  readonly imageCount: ImageCount;
  readonly aspectRatio: AspectRatioConfig;
}

export type WizardAction =
  | { readonly type: "set-step"; readonly step: 1 | 2 | 3 | 4 }
  | {
      readonly type: "set-draft-key";
      readonly provider: Provider;
      readonly apiKey: string;
    }
  | { readonly type: "validate-start"; readonly provider: Provider }
  | {
      readonly type: "validate-success";
      readonly provider: Provider;
      readonly tier: Tier;
      readonly ipm: number;
    }
  | {
      readonly type: "validate-error";
      readonly provider: Provider;
      readonly error: NormalizedError;
    }
  | { readonly type: "set-gemini-tier"; readonly tier: Tier }
  | { readonly type: "clear-provider"; readonly provider: Provider }
  | { readonly type: "set-image-count"; readonly count: ImageCount }
  | { readonly type: "set-aspect"; readonly aspect: AspectRatioConfig }
  | { readonly type: "complete" };

export function initialState(): WizardState {
  return {
    step: 1,
    providers: {
      openai: { phase: "idle" },
      gemini: { phase: "idle" },
    },
    imageCount: 4,
    aspectRatio: { kind: "discrete", ratio: "1:1" },
  };
}

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case "set-step":
      return { ...state, step: action.step };

    case "set-draft-key": {
      const current = state.providers[action.provider];
      if (current.phase === "validating") return state;
      return {
        ...state,
        providers: {
          ...state.providers,
          [action.provider]: { phase: "editing", apiKey: action.apiKey },
        },
      };
    }

    case "validate-start": {
      const current = state.providers[action.provider];
      if (current.phase === "validating") return state;
      if (current.phase !== "editing" && current.phase !== "error") return state;
      return {
        ...state,
        providers: {
          ...state.providers,
          [action.provider]: { phase: "validating", apiKey: current.apiKey },
        },
      };
    }

    case "validate-success": {
      const current = state.providers[action.provider];
      if (current.phase !== "validating") return state;
      return {
        ...state,
        providers: {
          ...state.providers,
          [action.provider]: {
            phase: "validated",
            apiKey: current.apiKey,
            tier: action.tier,
            ipm: action.ipm,
          },
        },
      };
    }

    case "validate-error": {
      const current = state.providers[action.provider];
      if (current.phase !== "validating") return state;
      return {
        ...state,
        providers: {
          ...state.providers,
          [action.provider]: {
            phase: "error",
            apiKey: current.apiKey,
            error: action.error,
          },
        },
      };
    }

    case "set-gemini-tier": {
      const current = state.providers.gemini;
      if (current.phase !== "validated") return state;
      return {
        ...state,
        providers: {
          ...state.providers,
          gemini: { ...current, tier: action.tier },
        },
      };
    }

    case "clear-provider":
      return {
        ...state,
        providers: {
          ...state.providers,
          [action.provider]: { phase: "idle" },
        },
      };

    case "set-image-count":
      return { ...state, imageCount: action.count };

    case "set-aspect":
      return { ...state, aspectRatio: action.aspect };

    case "complete":
      return state;
  }
}
