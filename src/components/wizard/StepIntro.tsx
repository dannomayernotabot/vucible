"use client";

import { useWizard } from "./WizardContext";
import { WIZARD_COPY } from "@/lib/wizard/copy";
import { Button } from "@/components/ui/button";

export function StepIntro() {
  const { dispatch } = useWizard();

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl" style={{ lineHeight: 1.08 }}>
        {WIZARD_COPY.step1.title}
      </h1>
      <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
        {WIZARD_COPY.step1.body}
      </p>
      <Button
        className="mt-8 h-12 px-8 text-base font-medium sm:mt-10"
        onClick={() => dispatch({ type: "set-step", step: 2 })}
      >
        {WIZARD_COPY.step1.cta} &rarr;
      </Button>
    </div>
  );
}
