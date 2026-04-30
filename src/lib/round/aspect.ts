import type {
  AspectRatioConfig,
  GeminiSupportedRatio,
  Provider,
  ProviderConfig,
} from "@/lib/providers/types";

const GEMINI_RATIOS: readonly { ratio: GeminiSupportedRatio; value: number }[] = [
  { ratio: "1:1", value: 1 },
  { ratio: "3:2", value: 3 / 2 },
  { ratio: "2:3", value: 2 / 3 },
  { ratio: "3:4", value: 3 / 4 },
  { ratio: "4:3", value: 4 / 3 },
  { ratio: "4:5", value: 4 / 5 },
  { ratio: "5:4", value: 5 / 4 },
  { ratio: "9:16", value: 9 / 16 },
  { ratio: "16:9", value: 16 / 9 },
  { ratio: "21:9", value: 21 / 9 },
];

export function findNearestRatio(width: number, height: number): GeminiSupportedRatio {
  const target = width / height;
  let best = GEMINI_RATIOS[0];
  let bestDelta = Math.abs(target - best.value);
  for (let i = 1; i < GEMINI_RATIOS.length; i++) {
    const delta = Math.abs(target - GEMINI_RATIOS[i].value);
    if (delta < bestDelta) {
      best = GEMINI_RATIOS[i];
      bestDelta = delta;
    }
  }
  return best.ratio;
}

export function snapAspectIfNeeded(
  aspect: AspectRatioConfig,
  providers: Partial<Record<Provider, ProviderConfig>>,
): AspectRatioConfig {
  if (!providers.gemini) return aspect;
  if (aspect.kind === "discrete") return aspect;
  return { kind: "discrete", ratio: findNearestRatio(aspect.width, aspect.height) };
}
