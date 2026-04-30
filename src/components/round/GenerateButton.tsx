"use client";

import { Button } from "@/components/ui/button";

interface GenerateButtonProps {
  readonly isRunning: boolean;
  readonly bothDisabled: boolean;
  readonly promptEmpty: boolean;
  readonly onGenerate: () => void;
}

export function GenerateButton({
  isRunning,
  bothDisabled,
  promptEmpty,
  onGenerate,
}: GenerateButtonProps) {
  const disabled = isRunning || bothDisabled || promptEmpty;

  let title: string | undefined;
  if (bothDisabled) title = "Enable at least one provider";
  else if (promptEmpty) title = "Enter a prompt";

  return (
    <Button
      type="button"
      disabled={disabled}
      title={title}
      onClick={() => {
        if (isRunning) return;
        onGenerate();
      }}
    >
      {isRunning ? "Generating..." : "Generate"}
    </Button>
  );
}
