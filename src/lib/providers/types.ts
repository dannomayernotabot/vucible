export type Provider = "openai" | "gemini";

export type Tier = "free" | "tier1" | "tier2" | "tier3" | "tier4" | "tier5";

export interface ProviderConfig {
  readonly apiKey: string;
  readonly tier: Tier;
  readonly ipm: number;
  readonly concurrencyCap: number;
  readonly validatedAt: string;
}

export type GeminiSupportedRatio =
  | "1:1"
  | "1:4"
  | "1:8"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:1"
  | "4:3"
  | "4:5"
  | "5:4"
  | "8:1"
  | "9:16"
  | "16:9"
  | "21:9";

export type AspectRatioConfig =
  | { readonly kind: "discrete"; readonly ratio: GeminiSupportedRatio }
  | { readonly kind: "freeform"; readonly width: number; readonly height: number };

export type ImageCount = 4 | 8 | 16;

export interface UserDefaults {
  readonly imageCount: ImageCount;
  readonly aspectRatio: AspectRatioConfig;
  readonly theme: "system" | "dark" | "light";
}

export interface VucibleStorageV1 {
  readonly schemaVersion: 1;
  readonly providers: Partial<Record<Provider, ProviderConfig>>;
  readonly defaults: UserDefaults;
  readonly openaiModel?: string;
  readonly createdAt: string;
}
