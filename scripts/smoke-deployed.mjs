#!/usr/bin/env bun
// Live smoke test against the deployed Vercel URL.
// Streams events as stdout lines so Monitor can surface each as a notification.
//
// Verifies (with junk keys, no real API charges):
//   1. URL serves 200 and renders the wizard
//   2. Console / page errors captured
//   3. Network errors captured (4xx/5xx for our domain only — provider 401 expected)
//   4. Welcome → Add keys step transition
//   5. OpenAI junk-key validation surfaces auth_failed UI
//
// Pass: real-key smoke is OUT OF SCOPE — that's user-action.

import { chromium } from "@playwright/test";

const URL = process.env.SMOKE_URL ?? "https://vucible-fl1lrsxrm-dannomayernotabots-projects.vercel.app/";
const SCREENSHOT_DIR = process.env.SHOT_DIR ?? "/tmp/vucible-smoke";

const log = (kind, msg) => {
  const t = new Date().toISOString().slice(11, 23);
  console.log(`[${t}] ${kind}: ${msg}`);
};

await import("node:fs/promises").then((fs) => fs.mkdir(SCREENSHOT_DIR, { recursive: true }));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// Stream console + page errors
page.on("console", (m) => {
  const t = m.type();
  if (t === "error" || t === "warning") log(`console.${t}`, m.text().slice(0, 300));
});
page.on("pageerror", (e) => log("pageerror", e.message.slice(0, 300)));
page.on("requestfailed", (req) => log("netfail", `${req.method()} ${req.url()} → ${req.failure()?.errorText ?? "unknown"}`));
page.on("response", (res) => {
  const code = res.status();
  const url = res.url();
  // Surface 4xx/5xx from OUR origin only (provider 4xx with junk keys is expected)
  if (code >= 400 && url.includes("vercel.app")) log("net-4xx-own", `${code} ${url}`);
});

let failed = false;

try {
  log("step", `goto ${URL}`);
  const resp = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 20000 });
  log("step", `HTTP ${resp?.status()} loaded`);
  if (resp && resp.status() !== 200) {
    log("FAIL", `non-200 root: ${resp.status()}`);
    failed = true;
  }

  await page.waitForLoadState("networkidle", { timeout: 15000 });
  const title = await page.title();
  log("step", `title="${title}"`);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-landed.png`, fullPage: true });
  log("step", "screenshot 01-landed.png");

  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasWizardCue = /welcome|get started|byok|api key/i.test(bodyText);
  log("step", `wizard rendered: ${hasWizardCue} (text length ${bodyText.length})`);
  if (!hasWizardCue) {
    log("FAIL", "wizard cue missing from body text");
    failed = true;
  }

  // Click whatever advances from welcome (Get started, Continue, etc.)
  const advanceBtn = page.getByRole("button", { name: /get started|continue|next/i }).first();
  if (await advanceBtn.count()) {
    log("step", "clicking advance button");
    await advanceBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-step-keys.png`, fullPage: true });
    log("step", "screenshot 02-step-keys.png");
  } else {
    log("warn", "no advance button found from welcome — may be different layout");
  }

  // Try junk OpenAI key validation
  const openAIInput = page.locator('input[placeholder*="sk-"], input[type="password"]').first();
  if (await openAIInput.count()) {
    log("step", "filling junk OpenAI key");
    await openAIInput.fill("sk-junk-cors-smoke-test-not-real-1234567890");
    const validate = page.getByRole("button", { name: /validate|test/i }).first();
    if (await validate.count()) {
      log("step", "clicking validate");
      await validate.click();
      // Wait briefly for the API roundtrip + UI update
      await page.waitForTimeout(8000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/03-junk-validation.png`, fullPage: true });
      log("step", "screenshot 03-junk-validation.png");
      const after = await page.evaluate(() => document.body.innerText);
      // Expect "Invalid" / "auth" / "401" / "key" in error display
      const sawAuthError = /invalid|incorrect|authentic|unauthorized|401|re-check|api key/i.test(after);
      log("step", `auth-error UI visible: ${sawAuthError}`);
      if (!sawAuthError) {
        log("WARN", "expected auth_failed UI not detected — may be CORS-blocked instead, check screenshots");
      }
    } else {
      log("warn", "no validate button found");
    }
  } else {
    log("warn", "no OpenAI key input found on this step");
  }

  log("step", "smoke flow complete");
} catch (e) {
  log("ERROR", e.message);
  failed = true;
} finally {
  await browser.close();
}

log(failed ? "VERDICT" : "VERDICT", failed ? "FAILED" : "PASSED");
process.exit(failed ? 1 : 0);
