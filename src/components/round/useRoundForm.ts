import { useReducer, useCallback } from "react";
import type {
  AspectRatioConfig,
  ImageCount,
  Provider,
} from "@/lib/providers/types";
import { snapAspectIfNeeded } from "@/lib/round/aspect";
import { getStorage } from "@/lib/storage/keys";
import type { StartRoundInput } from "@/lib/round/orchestrate";

export interface RoundFormState {
  readonly prompt: string;
  readonly modelsEnabled: { readonly openai: boolean; readonly gemini: boolean };
  readonly aspect: AspectRatioConfig;
  readonly imageCount: ImageCount;
}

type RoundFormAction =
  | { type: "set-prompt"; prompt: string }
  | { type: "toggle-model"; provider: Provider }
  | { type: "set-aspect"; aspect: AspectRatioConfig }
  | { type: "set-image-count"; count: ImageCount }
  | { type: "reset" };

function initialState(): RoundFormState {
  const storage = getStorage();
  const defaults = storage?.defaults;
  return {
    prompt: "",
    modelsEnabled: {
      openai: !!storage?.providers.openai,
      gemini: !!storage?.providers.gemini,
    },
    aspect: defaults?.aspectRatio ?? { kind: "discrete", ratio: "1:1" },
    imageCount: defaults?.imageCount ?? 8,
  };
}

function reduce(state: RoundFormState, action: RoundFormAction): RoundFormState {
  switch (action.type) {
    case "set-prompt":
      return { ...state, prompt: action.prompt };

    case "toggle-model": {
      const next = {
        ...state.modelsEnabled,
        [action.provider]: !state.modelsEnabled[action.provider],
      };
      const newState = { ...state, modelsEnabled: next };
      if (action.provider === "gemini" && next.gemini) {
        const storage = getStorage();
        const providers = storage?.providers ?? {};
        return {
          ...newState,
          aspect: snapAspectIfNeeded(newState.aspect, providers),
        };
      }
      return newState;
    }

    case "set-aspect":
      return { ...state, aspect: action.aspect };

    case "set-image-count":
      return { ...state, imageCount: action.count };

    case "reset":
      return initialState();
  }
}

export function useRoundForm(isRunning: boolean) {
  const [state, rawDispatch] = useReducer(reduce, undefined, initialState);

  const dispatch = useCallback(
    (action: RoundFormAction) => {
      if (isRunning) return;
      rawDispatch(action);
    },
    [isRunning],
  );

  const snapshot = useCallback((): StartRoundInput => {
    return {
      prompt: state.prompt,
      modelsEnabled: state.modelsEnabled,
      count: state.imageCount,
      aspect: state.aspect,
    };
  }, [state]);

  return { state, dispatch, snapshot };
}
