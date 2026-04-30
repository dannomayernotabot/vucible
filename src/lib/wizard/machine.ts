import type { Provider, Tier, UserDefaults } from "@/lib/providers/types";
import type { NormalizedError } from "@/lib/providers/errors";
import type {
  DraftProviderEntry,
  WizardProgress,
} from "@/lib/storage/wizard-progress";

type WizardAction =
  | { type: "set-step"; step: 1 | 2 | 3 | 4 }
  | { type: "set-draft-key"; provider: Provider; apiKey: string }
  | { type: "validate-start"; provider: Provider }
  | { type: "validate-success"; provider: Provider; tier: Tier; ipm: number }
  | { type: "validate-error"; provider: Provider; error: NormalizedError }
  | { type: "set-gemini-mode"; enabled: boolean }
  | { type: "set-defaults"; defaults: Partial<UserDefaults> }
  | { type: "clear-provider"; provider: Provider }
  | { type: "complete" };

interface WizardState {
  step: 1 | 2 | 3 | 4;
  draftProviders: Partial<
    Record<Provider, DraftProviderEntry & { validating?: boolean }>
  >;
  draftDefaults: Partial<UserDefaults>;
  completed: boolean;
}

function initialState(progress: WizardProgress | null): WizardState {
  if (progress) {
    return {
      step: progress.step,
      draftProviders: progress.draftProviders,
      draftDefaults: progress.draftDefaults ?? {},
      completed: false,
    };
  }
  return { step: 1, draftProviders: {}, draftDefaults: {}, completed: false };
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "set-step":
      return { ...state, step: action.step };
    case "set-draft-key":
      return {
        ...state,
        draftProviders: {
          ...state.draftProviders,
          [action.provider]: {
            ...state.draftProviders[action.provider],
            apiKey: action.apiKey,
            error: undefined,
            validatedAt: undefined,
            tier: undefined,
            ipm: undefined,
          },
        },
      };
    case "validate-start":
      return {
        ...state,
        draftProviders: {
          ...state.draftProviders,
          [action.provider]: {
            ...state.draftProviders[action.provider],
            validating: true,
            error: undefined,
          },
        },
      };
    case "validate-success":
      return {
        ...state,
        draftProviders: {
          ...state.draftProviders,
          [action.provider]: {
            ...state.draftProviders[action.provider],
            validating: false,
            tier: action.tier,
            ipm: action.ipm,
            validatedAt: new Date().toISOString(),
            error: undefined,
          },
        },
      };
    case "validate-error":
      return {
        ...state,
        draftProviders: {
          ...state.draftProviders,
          [action.provider]: {
            ...state.draftProviders[action.provider],
            validating: false,
            error: action.error,
          },
        },
      };
    case "set-gemini-mode": {
      if (!action.enabled) {
        const { gemini: _, ...rest } = state.draftProviders;
        return { ...state, draftProviders: rest };
      }
      return {
        ...state,
        draftProviders: {
          ...state.draftProviders,
          gemini: state.draftProviders.gemini ?? {},
        },
      };
    }
    case "set-defaults":
      return {
        ...state,
        draftDefaults: { ...state.draftDefaults, ...action.defaults },
      };
    case "clear-provider": {
      const { [action.provider]: _, ...rest } = state.draftProviders;
      return { ...state, draftProviders: rest };
    }
    case "complete":
      return { ...state, completed: true };
  }
}

export type { WizardAction, WizardState };
export { wizardReducer, initialState };
