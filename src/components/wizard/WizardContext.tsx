"use client";

import { createContext, useContext } from "react";
import type { WizardState, WizardAction } from "@/lib/wizard/machine";

interface WizardContextValue {
  state: WizardState;
  dispatch: (action: WizardAction) => void;
}

export const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardShell");
  return ctx;
}
