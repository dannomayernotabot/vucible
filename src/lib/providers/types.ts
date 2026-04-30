export type Provider = "openai" | "gemini";

export type Tier = "free" | "tier1" | "tier2" | "tier3" | "tier4" | "tier5";

export interface ProviderConfig {
  apiKey: string;
  tier: Tier;
  ipm: number;
  concurrencyCap: number;
  validatedAt: string;
}

export type GeminiSupportedRatio =
  | "1:1"
  | "3:2"
  | "2:3"
  | "3:4"
  | "4:3"
  | "4:5"
  | "5:4"
  | "9:16"
  | "16:9"
  | "21:9";

export type AspectRatioConfig =
  | { kind: "discrete"; ratio: GeminiSupportedRatio }
  | { kind: "freeform"; width: number; height: number };

export interface UserDefaults {
  imageCount: 4 | 8 | 16;
  aspectRatio: AspectRatioConfig;
  theme: "system" | "dark" | "light";
}

export interface VucibleStorageV1 {
  schemaVersion: 1;
  providers: Partial<Record<Provider, ProviderConfig>>;
  defaults: UserDefaults;
  createdAt: string;
}
