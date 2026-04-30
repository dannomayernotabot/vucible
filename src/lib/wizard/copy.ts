// src/lib/wizard/copy.ts

export const WIZARD_COPY = {
  step1: {
    title: "Welcome to Vucible",
    body: "Vucible uses your own API keys to generate and evolve images. Your keys stay in your browser and are never sent to our servers.",
    cta: "Get Started",
  },
  step2: {
    header: "Connect Your API Keys",
    recommend: "We recommend starting with OpenAI. Add Gemini for more options.",
    openai: {
      label: "OpenAI API Key",
      placeholder: "sk-...",
      help: "Get a key at platform.openai.com/api-keys",
      validateLabel: "Test Key",
      validatingLabel: "Testing...",
      successLabel: "Key verified",
    },
    gemini: {
      label: "Gemini API Key",
      placeholder: "AIza...",
      help: "Get a key at aistudio.google.com/apikey",
      validateLabel: "Test Key",
      validatingLabel: "Testing...",
      successLabel: "Key verified",
      toggleLabel: "Also use Gemini",
    },
    cta: "Next",
  },
  step3: {
    header: "Set Your Defaults",
    imageCount: {
      label: "Images per round",
      options: { 4: "4 images", 8: "8 images", 16: "16 images" },
    },
    aspectRatio: {
      label: "Default aspect ratio",
    },
    theme: {
      label: "Theme",
      options: { system: "System", dark: "Dark", light: "Light" },
    },
    cta: "Next",
  },
  step4: {
    header: "Ready to Go",
    body: "You can change these settings anytime from the gear icon.",
    cta: "Start Creating",
  },
  errors: {
    auth_failed: "Invalid API key. Double-check and try again.",
    rate_limited: "Rate limited. Wait a moment and try again.",
    network_error: "Network error. Check your connection.",
    server_error: "Provider error. Try again in a moment.",
    bad_request: "Validation failed.",
    content_blocked: "Content blocked by safety filter.",
    quota_exhausted: "Quota exhausted. Add billing or wait for reset.",
    unknown: "Unexpected error. Try again.",
  },
} as const;

export type WizardCopy = typeof WIZARD_COPY;
