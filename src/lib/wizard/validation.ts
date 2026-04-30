export function isPlausibleOpenAIKey(s: string): boolean {
  const trimmed = s.trim();
  return trimmed.startsWith("sk-") && trimmed.length >= 30;
}

export function isPlausibleGeminiKey(s: string): boolean {
  const trimmed = s.trim();
  return trimmed.startsWith("AIza") && trimmed.length >= 30;
}
