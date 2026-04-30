import type { Provider, Tier, UserDefaults } from "@/lib/providers/types";
import type { NormalizedError } from "@/lib/providers/errors";

const WIZARD_KEY = "vucible:wizard-progress";

export interface DraftProviderEntry {
  readonly apiKey?: string;
  readonly tier?: Tier;
  readonly ipm?: number;
  readonly validatedAt?: string;
  readonly error?: NormalizedError;
}

export interface WizardProgress {
  readonly step: 1 | 2 | 3 | 4;
  readonly draftProviders: Partial<Record<Provider, DraftProviderEntry>>;
  readonly draftDefaults?: Partial<UserDefaults>;
}

export function getProgress(): WizardProgress | null {
  const raw = window.localStorage.getItem(WIZARD_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  if (typeof record.step !== "number" || ![1, 2, 3, 4].includes(record.step)) {
    return null;
  }

  return parsed as WizardProgress;
}

export function setProgress(progress: WizardProgress): void {
  window.localStorage.setItem(WIZARD_KEY, JSON.stringify(progress));
}

export function clearProgress(): void {
  window.localStorage.removeItem(WIZARD_KEY);
}
