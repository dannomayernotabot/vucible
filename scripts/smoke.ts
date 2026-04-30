#!/usr/bin/env bun
/**
 * Manual smoke test for OpenAI + Gemini provider clients.
 * Usage: OPENAI_API_KEY=sk-... GEMINI_API_KEY=AI... bun run scripts/smoke.ts
 */

import * as openai from "../src/lib/providers/openai";
import * as gemini from "../src/lib/providers/gemini";
import { PNG_1x1, toBase64 } from "../src/test/fixtures/images";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

function section(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function pass(label: string) {
  console.log(`  [PASS] ${label}`);
}

function fail(label: string, detail: unknown) {
  console.log(`  [FAIL] ${label}`);
  console.log(`         ${JSON.stringify(detail, null, 2).slice(0, 500)}`);
}

async function testOpenAI() {
  if (!OPENAI_KEY) {
    console.log("  SKIPPED (no OPENAI_API_KEY)");
    return;
  }

  section("OpenAI: testGenerate");
  const testResult = await openai.testGenerate(OPENAI_KEY);
  if (testResult.ok) {
    pass(`tier=${testResult.tier}, ipm=${testResult.ipm}`);
  } else {
    fail("testGenerate", testResult.error);
  }

  section("OpenAI: generate (no references)");
  const genResult = await openai.generate(OPENAI_KEY, {
    prompt: "a single solid color square",
    size: { width: 1024, height: 1024 },
  });
  if (genResult.ok) {
    pass(`image ${genResult.image.byteLength} bytes, mimeType=${genResult.mimeType}`);
  } else {
    fail("generate", genResult.error);
  }

  section("OpenAI: generate (with 1 reference)");
  const refResult = await openai.generate(OPENAI_KEY, {
    prompt: "make the square blue",
    size: { width: 1024, height: 1024 },
    referenceImages: [{ bytes: PNG_1x1, mimeType: "image/png" }],
  });
  if (refResult.ok) {
    pass(`image ${refResult.image.byteLength} bytes, mimeType=${refResult.mimeType}`);
  } else {
    fail("generate with ref", refResult.error);
  }
}

async function testGemini() {
  if (!GEMINI_KEY) {
    console.log("  SKIPPED (no GEMINI_API_KEY)");
    return;
  }

  section("Gemini: listModels");
  const listResult = await gemini.listModels(GEMINI_KEY);
  if (listResult.ok) {
    pass("listModels returned ok");
  } else {
    fail("listModels", listResult.error);
  }

  section("Gemini: generate (no references)");
  const genResult = await gemini.generate(GEMINI_KEY, {
    prompt: "a single solid color square",
    aspectRatio: "1:1",
  });
  if (genResult.ok) {
    pass(`image ${genResult.image.byteLength} bytes, mimeType=${genResult.mimeType}`);
  } else {
    fail("generate", genResult.error);
  }

  section("Gemini: generate (with 1 reference)");
  const refResult = await gemini.generate(GEMINI_KEY, {
    prompt: "make the square blue",
    aspectRatio: "1:1",
    referenceImages: [{ base64: toBase64(PNG_1x1), mimeType: "image/png" }],
  });
  if (refResult.ok) {
    pass(`image ${refResult.image.byteLength} bytes, mimeType=${refResult.mimeType}`);
  } else {
    fail("generate with ref", refResult.error);
  }
}

async function main() {
  console.log("vucible provider smoke test");
  console.log(`OpenAI key: ${OPENAI_KEY ? "present" : "MISSING"}`);
  console.log(`Gemini key: ${GEMINI_KEY ? "present" : "MISSING"}`);

  await testOpenAI();
  await testGemini();

  console.log("\n--- smoke test complete ---");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
