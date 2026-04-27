# vucible — Design Decisions

> ADR-style log of key technical and product decisions. Each decision has a date, context, decision, rationale, and consequences. Decisions are immutable once written — supersede them with a new entry rather than editing in place.

Last updated: 2026-04-26

---

## DD-001: Pure client-side, BYOK architecture

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** We need image generation from OpenAI and Google. Either we proxy calls through our own backend (we hold/forward user keys) or we call the APIs directly from the browser (user keys live in `localStorage` and never touch our servers).

**Decision.** Direct browser → OpenAI / Google. BYOK keys in `localStorage`. No backend proxy.

**Why.** (1) We do not want to be in the path of users' API quotas, billing, or trust. (2) Lower operational cost and complexity for the project owner. (3) Both target APIs support browser-origin calls with the user's own key.

**Consequences.** No server-side rate-limiting or cost guardrails — costs are entirely the user's responsibility. We expose a "danger" pattern (API keys in browser memory); we mitigate by never persisting keys outside `localStorage` on the user's machine. We may need to revisit if CORS or vendor policy changes.

---

## DD-002: Stack — Next.js 15 + TypeScript + Tailwind + shadcn/ui

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** Need a modern React stack with strong defaults. Considered Vite + React (smaller, more "right-sized" for a SPA) and Next.js 15 (more framework, but has a published best-practices guide we plan to follow).

**Decision.** Next.js 15 (App Router), TypeScript, Tailwind v4, shadcn/ui.

**Why.** The Dicklesworthstone agent-farm best-practices guide for Next.js 15 is the reference document for this project (see `docs/best-practices/NEXTJS15_BEST_PRACTICES.md`). Bias toward following published guidance over a more minimal stack we'd have to define ourselves. shadcn/ui gives us clean, accessible primitives without committing to a heavy component library.

**Consequences.** Slightly more framework than strictly necessary for a BYOK SPA. We will likely use `'use client'` throughout and may add `output: 'export'` if we ever want fully static deploys. Server actions / API routes are available if we need them later (e.g., for sharing).

**Update 2026-04-26.** Initial scaffold uses **Next.js 16.2.4** (latest stable at scaffold time). The framework + App Router decision stands; only the version number is updated. `AGENTS.md` warns that Next 16 has breaking changes vs. training data and instructs the agent to read `node_modules/next/dist/docs/` before writing code.

---

## DD-003: Image gen models — latest OpenAI + latest Gemini, no others in MVP

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** Many image gen providers exist. Picking which to support in MVP shapes the product surface.

**Decision.** Two models only: **OpenAI's `gpt-image-2`** and **Google's `Gemini 3.1 Pro Preview` image generation model**. Both are "latest and greatest" of their respective providers. No Stable Diffusion, no Midjourney, no others in MVP.

**Why.** These are the highest-quality available models that also support image input as references — a hard requirement for the round-2+ evolution mechanism (see DD-005). Two providers gives us cross-provider diversity without exploding the integration surface.

**Consequences.** When we add a third provider later, we'll need to revisit the per-round model toggle UI (which currently assumes 2 models). We need to verify exact API model strings during integration — model names may differ slightly from the provider IDs.

> **Open at integration time:** Confirm exact API model identifiers. The product names recorded here ("gpt-image-2", "Gemini 3.1 Pro Preview") need to be mapped to whatever string the SDK / REST API expects.

---

## DD-004: Storage — IndexedDB for history, localStorage for keys

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** We need to persist (a) API keys and (b) iteration history (prompts, generated images as base64 / URLs, selections). Considered Supabase (free tier) for cross-device sync.

**Decision.** Keys in `localStorage` (small, sync-style API). History in IndexedDB. No backend.

**Why.** IndexedDB handles large image payloads well; `localStorage` does not. Supabase would add setup friction (project, keys, schema), would push us toward needing accounts, and the 1 GB free storage tier fills fast at 16 images per round.

**Consequences.** No cross-device sync — a session is bound to one browser/profile. If the user clears site data, history is gone. Acceptable for MVP; revisit if users ask for sync.

---

## DD-005: Round 2+ evolution — direct image references, no LLM rewriting

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** When the user picks 1–4 favorites and we generate the next round, we need to translate "these images + this commentary" into N new image-gen calls. Three options considered:
  (a) LLM synthesizes 16 diverse new prompts from selections + commentary; each gen call is text-only.
  (b) Direct image references: each gen call gets original prompt + selected images as references + an evolve directive.
  (c) Hybrid: LLM writes diverse prompts, each gen call also receives selected images as references.

**Decision.** Option (b) — direct image references with the original prompt.

**Why.** Once the user has picked favorites, increased visual continuity (the "groove") is a feature, not a bug — the user is steering the convergence. We trust the natural variance of the image gen models to provide enough round-to-round diversity. Option (a) is more complex and introduces an LLM dependency we don't otherwise need. We can layer (c) in later if (b) proves too convergent.

**Consequences.** Round 2+ output diversity depends on the underlying model's variance with image references. If we observe overly tight convergence, escalate to hybrid (option c). The evolve directive needs prompt-engineering: keep it minimal in MVP, iterate based on observed behavior.

**Update 2026-04-26.** Concrete prompt structure is now defined in **DD-015**. DD-005's structural decision (image refs + original prompt, no LLM rewriting) stands.

---

## DD-006: Round 1 — same prompt N times, no diversification

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** For the very first round we have no selected images yet. We could (a) run the user's prompt verbatim N times trusting model variance, or (b) use an LLM to expand the prompt into N varied sub-prompts.

**Decision.** Option (a) — same prompt N times.

**Why.** Simpler; one fewer dependency; image gen models do produce different outputs from the same prompt today. If first-round diversity proves insufficient in practice, easy to layer in (b) without changing the rest of the architecture.

**Consequences.** First-round results may cluster. If observed, add an optional LLM-diversify-prompt step before round 1 generation.

---

## DD-007: Image counts — {4, 8, 16}, even split across enabled models

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** How configurable should the per-round image count be? And how do we split when two models are enabled?

**Decision.** Three discrete options: **4, 8, 16**. When both models enabled, count is split evenly (e.g., 16 = 8 OpenAI + 8 Gemini). When one model enabled, all images come from that model.

**Why.** Free-form integers add UI complexity for no real value. {4, 8, 16} gives users a small/medium/large knob. Even split keeps cost predictable and the grid layout uniform.

**Consequences.** No 12, 6, etc. — fine. Users can't bias toward one model within a single round (they can only flip the model toggle entirely).

---

## DD-008: Selections — up to 4 per round, with optional commentary

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** How many favorites can a user pick per round?

**Decision.** **1 minimum, 4 maximum** selections per round. Free-form text commentary is optional.

**Why.** 1 ensures forward progress (something must seed the next round). 4 caps the complexity of the next gen prompt — image gen models accept multiple references but degrade with too many. Commentary is optional because users sometimes can articulate "I like #3 and #7" but not why.

**Consequences.** Users with strong opinions cannot pick 5+. If this proves limiting in real use, raise the cap.

---

## DD-009: Streaming — results render as they complete; live cost display

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** 16 parallel image gen calls take 10–30s each. We can either (a) wait for all to complete then render, or (b) render each as it arrives.

**Decision.** Stream — each completed call renders into its grid slot immediately. Per-call cost computed on completion; running total updates live.

**Why.** Better UX, no fundamental complexity cost.

**Consequences.** Grid layout must reserve slots up front so positions don't shift as images arrive. Need a per-slot loading skeleton state.

---

## DD-010: History — strictly linear, no branching or undo in MVP

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** Users may want to go back to round 3, pick different favorites, and fork a new round 4.

**Decision.** Strictly linear. No undo, no branching, no re-pick. Once you advance past a round, that round's selections are committed.

**Why.** Branching introduces a tree data model, navigation UI, and "current branch" state that significantly complicates MVP. The linear flow matches the user's mental model of "I'm converging" and is fast to ship. User explicitly chose linear-only when asked.

**Consequences.** If users complain, add branching as a follow-up feature. The IndexedDB schema should leave room for branching (e.g., each round has a `parent_round_id`) so we can extend later without migration.

---

## DD-011: No structured-input UI for prompt parameters in MVP

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** Aspect ratio, animation style, and similar parameters could each have dedicated UI (sliders, dropdowns with example previews). Considered and explicitly cut for MVP.

**Decision.** Single text prompt only. Users put aspect ratio, style, etc. directly into the prompt. No sliders, no dropdowns, no style pickers.

**Why.** Distracts from the core "evolution" mechanic. Building these well requires real polish (e.g., visual aspect-ratio slider with live frame preview, scrollable Ghibli-style example images for animation styles) — not worth it for v1.

**Consequences.** Less discoverability for novice users. Acceptable trade for MVP focus. Add post-MVP if it becomes a pain point.

**Update 2026-04-26.** **Aspect ratio** is no longer "in the prompt only" — see **DD-023**. The rest of DD-011 stands (no structured UI for animation style or other parameters in MVP).

---

## DD-012: Grid layout — two stacked sections grouped by model

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** When both models are enabled, we have N OpenAI images and N Gemini images. Display options: (a) two stacked sections with section headers, (b) interleaved with per-image badges, (c) side-by-side columns.

**Decision.** Two stacked sections, each labeled with the model name.

**Why.** Cleanest visual signal of which model produced which result. Makes the per-round model toggle feel coherent ("hide the Gemini section for next round").

**Consequences.** When only one model is enabled, the second section is absent (no empty slots). Layout must handle 1-section and 2-section cases.

---

## DD-013: Best-practices guides as authoritative reference

**Date:** 2026-04-25 · **Status:** Accepted

**Context.** Three best-practices guides from Dicklesworthstone/claude_code_agent_farm have been pulled into `docs/best-practices/`: Next.js 15, GenAI/LLM ops, and LLM dev/testing.

**Decision.** When in doubt about a stack-level pattern (file structure, data fetching, error handling, deployment, API integration), defer to those guides.

**Why.** External, opinionated guidance beats reinventing conventions for a small project.

**Consequences.** If a guide recommends something we explicitly want to deviate from, log it as a new design decision here with the rationale.

---

## DD-014: Free tier with hosted OSS image gen — considered and rejected

**Date:** 2026-04-26 · **Status:** Accepted

**Context.** Considered adding a free-to-use tier so users could try the full evolution loop without bringing API keys. Most viable model: **Qwen-Image-Edit** (Apache 2.0 weights, ~20B params, supports multi-image references — a hard requirement for round 2+ per DD-005). Hosting paths considered: serverless inference (Replicate / fal — pay per second, scales to zero) and self-hosted dedicated GPU (RunPod / Lambda — flat ~$1,080/month for an A100). Free tier would have introduced a backend, superseding DD-001.

**Decision.** Rejected. Stay BYOK-only.

**Why.** Open weights eliminate licensing fees but not GPU compute cost. Serverless runs ~$0.02/image for a Qwen-sized model; a free tier capped at 4 images × 4 rounds = 16 images per session ≈ $0.32/session worst case. Even with Cloudflare Turnstile + per-IP rate limits, at MVP traffic we'd be subsidizing scrapers more than serving real users. Self-hosting only beats serverless above ~50k images/month, which an MVP will not approach. The free tier was a marketing/UX feature, not a product feature; the cost was not justified.

**Consequences.** No "try in 30 seconds without a key" onboarding path. Users must bring OpenAI and/or Google API keys before generating anything. We accept the friction. Revisit if (a) traffic justifies self-hosting, (b) a sponsor or grant covers serverless inference cost, or (c) provider economics change materially (e.g., a cheap-enough hosted Qwen-Image-Edit endpoint emerges).

---

## DD-015: Evolve directive prompt structure

**Date:** 2026-04-26 · **Status:** Accepted

**Context.** DD-005 deferred the actual wording of the round 2+ evolve directive ("needs prompt-engineering, keep minimal, iterate based on observation"). v0 now defined. The structural question was what the model sees at round N: just the latest selections + commentary, or the full journey?

**Decision.** Each round-2+ generation call sends:
1. The original prompt verbatim.
2. The full history of user commentary from prior rounds in chronological order with round labels (raw text, not wrapped).
3. The K selected reference images from the most recent prior round (the only round whose images we still hold).
4. A single-line evolve instruction.

Same prompt verbatim across all parallel calls in a round; no per-call variation (we trust natural model variance per DD-005 / DD-006).

Two templates by round depth:

**Round 2:**
```
{original_prompt}

After round 1, the user selected the {K} attached images.
Their feedback: "{c1}"   (or: "(no feedback)")

Evolve from these references.
```

**Round N (N ≥ 3):**
```
{original_prompt}

User feedback by round:
- After round 1: "{c1 or '(no feedback)'}"
- After round 2: "{c2 or '(no feedback)'}"
- ...
- After round {N-1}: "{c_{N-1} or '(no feedback)'}"

The {K} attached images are the user's selections from round {N-1}.
Evolve from them.
```

**Why.** Sending the original prompt every round anchors the model to the user's stated intent; commentary functions as steering signal that can override or refine that intent. Raw commentary (not wrapped in `user feedback: <commentary>`) keeps the prompt honest to what the user actually said. We lose visual context from rounds before the most recent — the textual trail of commentary substitutes for the lost images. Trusting natural model variance instead of nudging for diversity is consistent with DD-005 and DD-006.

**Consequences.** Prompt length grows linearly with rounds. By round 8–10 with verbose commentary we may bump OpenAI's gpt-image prompt cap (~4000 chars) or Gemini's. **Accepted for v0.** If observed in practice, mitigations are (a) summarize older rounds and keep last 2–3 verbatim, or (b) hard-cap history at last N rounds. We do not pre-build either; observation drives the choice.

---

## DD-016: Per-provider concurrency throttle, tier-bound

**Date:** 2026-04-26 · **Status:** Accepted

**Context.** 16 parallel image gen calls is not feasible at entry-tier on either provider:

- **OpenAI gpt-image-1**: Tier 1 = 5 IPM, Tier 2 = 20 IPM, Tier 3 = 50 IPM, Tier 5 = 250 IPM.
- **Gemini (Nano Banana / Gemini 3 Pro Image)**: free-tier API = **0 IPM** for accounts created after Dec 2025; paid Tier 1 ≈ 10 IPM.

The retry-3x policy from the failure-handling decision absorbs bursts but is wrong for sustained rate-limit failures — it just delays the same 429.

**Decision.** Client-side concurrency throttle per provider. Calls beyond the cap queue locally and fire as slots free. Defaults: **5 OpenAI / 5 Gemini** (Tier 1 safe). The cap is configurable in settings (FR-9) but **bound by the user's detected tier max** — attempting to set above the tier max is blocked with explainer text and an upgrade link. Tier is **auto-detected from the test-connection call where the provider exposes rate-limit info cleanly (OpenAI via response headers); for providers where it isn't reliably exposed (Gemini), the user self-declares tier in settings and we enforce the matching cap.**

On 3 consecutive 429s for a provider, surface a banner: *"Hit your &lt;model&gt; rate limit. Upgrade your tier or lower the per-round image count."*

**Why.** Aligns the app with actual provider constraints. Turns "your round failed mysteriously" into "you're capped at 5 images/min on Tier 1, here's how to upgrade." The auto-detect + hard-cap enforcement keeps users from setting themselves up to fail.

**Consequences.** Round latency at low tiers is dominated by throttling, not by gen time — visible to users but tolerable. UI must show queued slots as "waiting…" tiles. Gemini auto-detection is best-effort; if it proves unreliable in practice we ship with self-declare only and document it. Settings changes take effect on the next call queued; in-flight calls are not affected.

---

## DD-017: First-run setup wizard, required for key entry

**Date:** 2026-04-26 · **Status:** Accepted

**Context.** BYOK (DD-001) means the user must have at least one validated provider key before the app can do anything. FR-1 originally described "UI for entering and clearing keys" without specifying when or how it appears. Gemini's free-tier API returning 0 IPM for image gen (DD-016 context) is the #1 way a new user will silently bounce — needs to be surfaced where they will see it.

**Decision.** First-run wizard, **required**, blocks the main UI until at least one provider key is entered and validated. Wizard contains:

1. **Brief BYOK explainer** — keys live in browser localStorage, never sent to our servers, your costs are yours.
2. **Per-provider card** for OpenAI and Gemini, each with:
   - Short "Get a key" link to the provider's keys page (OpenAI: `platform.openai.com/api-keys`, Gemini: `aistudio.google.com/app/apikey`).
   - Paste field + **test-connection on paste** (small no-op API call to validate).
   - On success, **auto-detect tier** (OpenAI from response headers; Gemini via user-declared dropdown).
   - On Gemini key with detected/declared 0 IPM (free tier post-Dec 2025), show a loud warning: *"Free Gemini API tier doesn't include image generation as of Dec 2025. Add billing in AI Studio to enable."*
3. **Multi-provider recommendation**: *"OpenAI and Gemini are built differently and produce more diverse outputs together. We recommend keys for both."*
4. **Light cost note**: *"Image gen runs roughly $0.04–0.08 per image. A 16-image round costs ~$0.64–1.28 across both providers."*
5. **No "skip for now" escape hatch.** At least one validated key is required to advance.

**Why.** Surfaces the BYOK + Gemini-free-tier reality at the exact moment users encounter it. Multi-provider blend is a meaningfully better product experience and worth recommending up front. Hard requirement of a key prevents the app from ever showing an empty/broken state.

**Consequences.** Higher friction for first-time users vs. a "demo first, sign up later" flow. Acceptable trade-off: there is no demo to show without keys (DD-014 rejected the hosted free tier). Wizard re-appears if all keys are subsequently cleared from settings.

**Update 2026-04-26.** Test-connection mechanics now defined in **DD-022**: OpenAI paste makes a small test image gen call (~$0.04, disclosed upfront) which both validates auth AND auto-detects tier from rate-limit headers; Gemini paste is a free list-models call for auth + a user-declared tier dropdown. Wizard concludes with a **default image count selector (4 / 8 / 16)** so users see their tier-bound IPM cap before choosing. Default cap before any tier info: 5 OpenAI / 5 Gemini per DD-016.

---

## DD-018: Settings page

**Date:** 2026-04-26 · **Status:** Accepted

**Context.** Users need a place to adjust defaults, manage keys, and re-tune concurrency without re-entering the wizard.

**Decision.** Settings page, accessible after wizard is completed. Contains:

1. **Default per-round image count** (4 / 8 / 16) — sets the *starting* selection in the per-round picker; per-round picker still wins for that round (DD-007 stands).
2. **Per-provider concurrency caps** (numeric input, hard-capped at detected/declared tier max per DD-016, blocked beyond with explainer + upgrade link).
3. **Live tier info per provider**: detected/declared tier, current IPM cap, what each tier allows, link to upgrade docs.
4. **Key management**: re-paste, clear, re-test connection per provider.
5. **Provider doc links**: API key creation, pricing, rate limits.

**Why.** Mirrors the wizard's controls with full ongoing access plus the advanced concurrency controls. Single location for ongoing config keeps the main UI uncluttered.

**Consequences.** Settings is "live" — concurrency changes take effect on the next call queued, not in-flight. Clearing all keys returns the app to wizard state on next reload (or immediately if we choose to short-circuit). The wizard and settings page share a single underlying form component to avoid drift.

---

## DD-019: Failure handling for parallel calls

**Date:** 2026-04-26 · **Status:** Accepted

**Context.** Some fraction of the 16 parallel image gen calls per round will fail — rate limits, content policy violations, server errors, network blips. Need a coherent strategy for retry, terminal failure, error messaging, and round-completion semantics.

**Decision.** Per-call:

1. **Retry up to 3x on retryable errors.** Retryable: 429 (rate limit), 5xx (server error), network / timeout errors. Non-retryable: 400 (bad request), 401 / 403 (auth), 422 (content policy violation) — these fail immediately to terminal state without retry.
2. **Backoff strategy.** Honor `Retry-After` header on 429 responses when present. Otherwise exponential backoff with jitter, ~1s / 2s / 4s.
3. **Retries respect the concurrency throttle (DD-016).** Re-queue into the per-provider local queue rather than firing immediately; we never bypass the throttle on retry.
4. **Per-error terminal messaging** on the failed-tile UI:
   - 429: *"Rate limit hit. Reduce concurrency in settings or upgrade your tier."*
   - 401 / 403: *"Authentication failed. Re-check your API key."*
   - 422 / content policy: *"Content blocked by safety filter. Try modifying the prompt."*
   - 5xx: *"Provider had a server error. Try regenerating."*
   - Network / timeout: *"Network error. Check your connection and try again."*
5. **User-driven slot regeneration.** Each terminal-failed tile shows a "Regenerate" button that re-queues the call with a fresh 3x retry budget.

Per-round:

6. **Round-settled condition.** Selection UI activates only once **all 16 slots are in terminal state** — success *or* failed-after-3-retries. The user always sees the full slate before deciding.
7. **Advancing rounds.** User selects 1–4 favorites from **successful** slots; failed slots are excluded from the selection set. User may advance without regenerating failed slots; they don't block forward progress.

**Why.** Retry-3x absorbs transient bursts without infinite loops. Honoring `Retry-After` and respecting the throttle prevents retry storms from compounding rate-limit pressure. Per-error-type messages turn mystery failures into actionable steps. Settling-then-selecting ensures the user makes selection decisions against the full slate, but excluding failed slots from selection rather than forcing regeneration prevents stuck states (e.g., persistent content-policy failures on a particular prompt + reference combo).

**Consequences.** Round latency at low tiers is dominated by throttle waits + occasional retry waits, not by raw gen time. The selection grid must visually distinguish three states per slot: loading, success, and terminal-failed (with reason and regenerate affordance). "All 16 succeed" is a goal, not a guarantee — user-initiated regeneration is the recovery path. Persistent provider outages will surface as full-round failures; the user can choose to abandon the round or wait.

---

## DD-020: Deploy target — Vercel via static export

**Date:** 2026-04-26 · **Status:** Accepted

**Context.** Need a hosting target. DD-001 rejected a backend; DD-002 noted `output: 'export'` is available. Options considered: Vercel (Next-native, free tier, GitHub integration), Cloudflare Pages (free, fast CDN, `next-on-pages`), GitHub Pages (free, awkward for Next), self-host (S3 + CloudFront, more ops).

**Decision.** Static export (`output: 'export'`) deployed to **Vercel** via GitHub integration.

**Why.** BYOK SPA with no server-side runtime → static export is correct. Vercel's free tier handles MVP traffic comfortably; GitHub integration is one-click. Static output has no platform lock-in — the build artifact deploys anywhere if Vercel ever stops being the right answer.

**Consequences.** No server actions / API routes available while on static export — acceptable per DD-001. Vercel free tier bandwidth (currently 100 GB/month) is generous for an MVP. Custom domain (`vucible.app`, `vucible.io`, etc.) is post-MVP.

---

## DD-021: History storage — no auto-GC, manual clear

**Date:** 2026-04-26 · **Status:** Accepted

**Context.** DD-004 stored history in IndexedDB. With 16 images per round at ~1MB each, a long session uses ~10–20 MB; many sessions can push hundreds of MB. IndexedDB has a quota (Chrome ≈ 50% of free disk in practice); eventually quota errors will surface.

**Decision.** No automatic GC in MVP. Settings page (FR-9) gets a **"Clear history"** button that wipes all rounds across all sessions; non-reversible. Quota constraint documented in settings.

**Why.** Automatic GC requires policy choices (oldest sessions first? age cap? size cap?) and adds code we don't need until we observe quota issues. Manual clear is one button; covers the failure mode (user gets quota errors) without prescribing a policy. Auto-GC can be layered on later from real usage data.

**Consequences.** Power users running hundreds of sessions may eventually hit quota errors. Storage layer must catch IndexedDB quota errors and surface a useful message: *"Storage full. Clear history in settings."* Cross-device sync remains out of scope per non-goals.

---

## DD-022: Key validation and tier detection mechanics

**Date:** 2026-04-26 · **Status:** Accepted

**Context.** DD-017 promised "test-connection on paste" with "tier auto-detect" but didn't specify what call gets made. DD-016 made the concurrency cap tier-bound. The wizard sets default image count, which depends on the user's effective IPM cap — so tier needs to be known **before** the user picks image count, i.e., on paste, not on first real gen.

**Decision.**

- **OpenAI on paste**: make a small test image gen call (smallest size, single image, ~$0.04). The response (a) validates auth, (b) exposes rate-limit headers from which we parse the tier and set the concurrency cap. The wizard surfaces detected tier and current IPM cap immediately. Test-image content is discarded — not shown to the user, not stored in history.
- **Gemini on paste**: free list-models call validates auth. Tier is **not** auto-detected (Gemini does not expose tier reliably in headers). User self-declares tier in the wizard via a dropdown (Free / Tier 1 / Tier 2 / Tier 3); concurrency cap enforced against the declared tier.
- **Cost-on-paste disclosure**: wizard tells the user *"We'll generate one small test image (~$0.04) on paste to detect your OpenAI tier."* before the paste field. No surprise cost.
- **Re-test connection** (in settings, FR-9): same mechanic; small test gen on OpenAI re-detects tier; Gemini re-validates auth and lets the user re-declare tier.

**Why.** Tier-on-paste lets the wizard's image-count step be tier-aware — users see what's actually available. Free list-models doesn't expose tier, so there's no zero-cost path that gets us tier info; we accept the small test-gen cost for the UX win. Gemini self-declare is a known caveat; we ship with it and revisit only if Gemini changes their API to expose tier in headers.

**Consequences.** Pasting a new OpenAI key costs ~$0.04 every time. Disclosed up front. Down-detection works: if a user thinks they're Tier 2 and headers say Tier 1, the cap auto-adjusts down with explanation. Re-testing in settings has the same cost. We swallow the test image (do not surface it) — a tiny user-visible side effect we accept rather than complicate the wizard with a "use this image as a preview" option.

---

## DD-023: Aspect ratio control with provider-aware constraints

**Date:** 2026-04-26 · **Status:** Accepted

**Context.** DD-011 originally cut all parameter UI on the assumption users would put aspect language in the prompt. Reality check: both image gen APIs use a `size` parameter, not prompt text, to control aspect — and the providers expose meaningfully different ranges:

- **OpenAI gpt-image-2**: arbitrary sizes, sweet-spot up to ~2560×1440. Any width × height works.
- **Gemini 3 Pro Image**: discrete list — `1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9`.

Forcing both into a common subset wastes OpenAI's flexibility; offering arbitrary input regardless of provider creates a silent mismatch on Gemini. Better to mirror provider reality directly.

**Decision.** Aspect ratio becomes a per-round UI control next to the model toggle (FR-4); the picker shape is **dynamic based on which providers are enabled**:

- **Gemini enabled (alone or alongside OpenAI)**: discrete picker showing the 10 Gemini-supported ratios as visual rectangle buttons.
- **OpenAI only (Gemini toggled off)**: freeform `width × height` (or `W:H`) input. Discrete buttons collapse under a "Quick presets" toggle for one-click access to common ratios.
- **Re-enabling Gemini after a freeform ratio**: auto-snap to nearest supported ratio with an inline note: *"Snapped to 21:9 (Gemini doesn't support 5:2 exactly)."* Non-blocking; user can override by toggling Gemini off again.

**Mechanism.** The chosen ratio drives:
1. The API `size` parameter (the actual lever) — e.g., 1024×1024 for 1:1, 1280×512 for 5:2, etc.
2. A redundant aspect hint appended to the prompt text — belt-and-suspenders against future model behavior changes.
3. The image card aspect in the grid — cards shaped to match the chosen ratio. Since aspect is per-round, all 16 cards share the shape (no masonry needed; clean N×M grid).

Default in wizard / settings: **1:1 (square)** — works on both providers, neutral starting point.

**Why.** "Mirror underlying functionality as much as possible" (user direction). Constraining the UI to provider capabilities prevents silent mismatches and gives power users full flexibility when they're using the unconstrained model. Per-round colocation with the model toggle reflects that they interact.

**Consequences.** UI must dynamically reshape based on the model toggle — small but real complexity. Snap-on-re-enable behavior needs clear UX to avoid surprising users. The cards-share-aspect simplification means we don't need masonry; a fixed grid suffices. DD-011 partially superseded (aspect specifically is now a UI control); rest of DD-011 stands.
