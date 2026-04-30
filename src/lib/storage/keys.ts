import type { VucibleStorageV1 } from "@/lib/providers/types";
import type { Provider, ProviderConfig } from "@/lib/providers/types";
import { STORAGE_KEY } from "./schema";
import {
  applyMigrations,
  CURRENT_SCHEMA_VERSION,
} from "./migrations/index";
import { snapAspectIfNeeded } from "@/lib/round/aspect";

export function getStorage(): VucibleStorageV1 | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  const migrated = applyMigrations(record, CURRENT_SCHEMA_VERSION);
  if (migrated === null) return null;

  if (migrated.schemaVersion !== CURRENT_SCHEMA_VERSION) return null;

  return migrated as unknown as VucibleStorageV1;
}

export function setStorage(storage: VucibleStorageV1): void {
  const snappedAspect = snapAspectIfNeeded(
    storage.defaults.aspectRatio,
    storage.providers,
  );

  const toWrite: VucibleStorageV1 = {
    ...storage,
    defaults: {
      ...storage.defaults,
      aspectRatio: snappedAspect,
    },
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toWrite));
}

export function clearStorage(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getEnabledProviderEntries(
  storage: VucibleStorageV1,
): Array<[Provider, ProviderConfig]> {
  const entries: Array<[Provider, ProviderConfig]> = [];
  const providers: Provider[] = ["openai", "gemini"];
  for (const p of providers) {
    const config = storage.providers[p];
    if (config) {
      entries.push([p, config]);
    }
  }
  return entries;
}
