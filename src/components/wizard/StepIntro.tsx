"use client";

import { useWizard } from "./WizardContext";
import { WIZARD_COPY } from "@/lib/wizard/copy";
import { Button } from "@/components/ui/button";

export function StepIntro() {
  const { dispatch } = useWizard();

  return (
    <div className="space-y-6 text-center">
      <h1 className="text-3xl font-bold tracking-tight">
        {WIZARD_COPY.step1.title}
      </h1>
      <p className="text-muted-foreground">{WIZARD_COPY.step1.body}</p>
      <Button size="lg" onClick={() => dispatch({ type: "set-step", step: 2 })}>
        {WIZARD_COPY.step1.cta} →
      </Button>
    </div>
  );
}
