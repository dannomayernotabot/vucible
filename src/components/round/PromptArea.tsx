"use client";

import { Textarea } from "@/components/ui/textarea";
import { ModelToggle } from "./ModelToggle";
import { AspectRatioPicker } from "./AspectRatioPicker";
import { ImageCountPicker } from "./ImageCountPicker";
import { GenerateButton } from "./GenerateButton";
import { NewSessionButton } from "./NewSessionButton";
import { useRoundForm, type RoundFormState } from "./useRoundForm";
import { useRound } from "./RoundProvider";

export function PromptArea() {
  const { isRunning, round, startRound } = useRound();
  const { state, dispatch, snapshot } = useRoundForm(isRunning);
  const hasSettled = round !== null && round.settledAt !== null;

  const bothDisabled = !state.modelsEnabled.openai && !state.modelsEnabled.gemini;

  return (
    <div className="space-y-4 p-4">
      <Textarea
        placeholder="Describe what you want to see..."
        value={state.prompt}
        onChange={(e) =>
          dispatch({ type: "set-prompt", prompt: e.target.value })
        }
        disabled={isRunning}
        aria-label="Prompt"
        rows={3}
      />

      <div className="flex flex-wrap items-center gap-4">
        <ModelToggle
          provider="openai"
          enabled={state.modelsEnabled.openai}
          onToggle={() => dispatch({ type: "toggle-model", provider: "openai" })}
          disabled={isRunning}
        />
        <ModelToggle
          provider="gemini"
          enabled={state.modelsEnabled.gemini}
          onToggle={() => dispatch({ type: "toggle-model", provider: "gemini" })}
          disabled={isRunning}
        />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div>
          <p className="mb-1.5 text-sm font-medium">Images per round</p>
          <ImageCountPicker
            value={state.imageCount}
            onChange={(count) =>
              dispatch({ type: "set-image-count", count })
            }
          />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Aspect ratio</p>
          <AspectRatioPicker
            geminiEnabled={state.modelsEnabled.gemini}
            value={state.aspect}
            onChange={(aspect) => dispatch({ type: "set-aspect", aspect })}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <GenerateButton
          isRunning={isRunning}
          bothDisabled={bothDisabled}
          promptEmpty={!state.prompt.trim()}
          onGenerate={() => startRound(snapshot())}
        />
        <NewSessionButton
          visible={hasSettled}
          onNewSession={() => dispatch({ type: "reset" })}
        />
      </div>
    </div>
  );
}
