import type { VucibleStorageV1 } from "@/lib/providers/types";
import type { ProviderThrottle } from "./throttle";

const SEED_WINDOW_MS = 60_000;

export function seedFromWizard(
  storage: VucibleStorageV1,
  throttles: { openai?: ProviderThrottle },
): void {
  const openai = storage.providers.openai;
  if (!openai?.validatedAt || !throttles.openai) return;

  const elapsed = Date.now() - new Date(openai.validatedAt).getTime();
  if (elapsed < 0 || elapsed >= SEED_WINDOW_MS) return;

  throttles.openai.seedConsumed(1, SEED_WINDOW_MS - elapsed);
}
