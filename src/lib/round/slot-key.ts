import type { Provider } from "@/lib/providers/types";

const VALID_PROVIDERS: ReadonlySet<string> = new Set<Provider>(["openai", "gemini"]);

export function slotKey(roundId: string, provider: Provider, index: number): string {
  return `${roundId}:${provider}:${index}`;
}

export function parseSlotKey(
  key: string,
): { roundId: string; provider: Provider; index: number } | null {
  const parts = key.split(":");
  if (parts.length !== 3) return null;

  const [roundId, providerStr, indexStr] = parts;
  if (!roundId || !VALID_PROVIDERS.has(providerStr)) return null;

  const index = Number(indexStr);
  if (!Number.isInteger(index) || index < 0) return null;

  return { roundId, provider: providerStr as Provider, index };
}
