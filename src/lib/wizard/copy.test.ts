import { describe, expect, it } from "vitest";
import { WIZARD_COPY, type WizardCopy } from "./copy";

describe("WIZARD_COPY", () => {
  it("all 4 steps have title or header and cta", () => {
    // step1 uses "title", steps 2-4 use "header"
    expect(WIZARD_COPY.step1.title).toBeTruthy();
    expect(WIZARD_COPY.step1.cta).toBeTruthy();

    expect(WIZARD_COPY.step2.header).toBeTruthy();
    expect(WIZARD_COPY.step2.cta).toBeTruthy();

    expect(WIZARD_COPY.step3.header).toBeTruthy();
    expect(WIZARD_COPY.step3.cta).toBeTruthy();

    expect(WIZARD_COPY.step4.header).toBeTruthy();
    expect(WIZARD_COPY.step4.cta).toBeTruthy();
  });

  it("all 8 error kinds have entries", () => {
    const expectedKeys = [
      "auth_failed",
      "rate_limited",
      "network_error",
      "server_error",
      "bad_request",
      "content_blocked",
      "quota_exhausted",
      "unknown",
    ] as const;

    expect(Object.keys(WIZARD_COPY.errors)).toHaveLength(expectedKeys.length);
    for (const key of expectedKeys) {
      expect(WIZARD_COPY.errors[key]).toBeTruthy();
    }
  });

  it("step2 has both openai and gemini sub-objects", () => {
    expect(WIZARD_COPY.step2.openai).toBeDefined();
    expect(WIZARD_COPY.step2.openai.label).toBeTruthy();
    expect(WIZARD_COPY.step2.openai.placeholder).toBeTruthy();
    expect(WIZARD_COPY.step2.openai.help).toBeTruthy();

    expect(WIZARD_COPY.step2.gemini).toBeDefined();
    expect(WIZARD_COPY.step2.gemini.label).toBeTruthy();
    expect(WIZARD_COPY.step2.gemini.placeholder).toBeTruthy();
    expect(WIZARD_COPY.step2.gemini.help).toBeTruthy();
    expect(WIZARD_COPY.step2.gemini.toggleLabel).toBeTruthy();
  });

  it("step3 imageCount.options has 4, 8, 16", () => {
    const options = WIZARD_COPY.step3.imageCount.options;
    expect(options[4]).toBeTruthy();
    expect(options[8]).toBeTruthy();
    expect(options[16]).toBeTruthy();
    expect(Object.keys(options)).toHaveLength(3);
  });

  it("type assertion: WizardCopy satisfies expected shape", () => {
    // Compile-time check — if WIZARD_COPY is missing keys this will fail to compile
    const _check: WizardCopy = WIZARD_COPY;
    expect(_check).toBe(WIZARD_COPY);
  });
});
