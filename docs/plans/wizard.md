# Vucible — First-Run Setup Wizard Implementation Plan

> **Status:** Initial draft (round 1)
> **Date:** 2026-04-27
> **Scope:** FR-8 (PRD.md), implementing DD-017, DD-022, with cross-refs to DD-001, DD-007, DD-016, DD-018, DD-023.
> **Slice:** Pre-implementation. No code yet. Designed for review pass via planning-workflow methodology, then handoff to beads-workflow for execution.

---

## 1. Why this slice first

The wizard is the only entry point to the app — `DD-017` made it required, no escape hatch. Until it works, **nothing else in vucible can be exercised end-to-end**: no key entry → no API calls → no rounds → no selection → no evolution. Building the wizard first gives us a working "key paste → tier detection → defaults persisted" loop that all subsequent slices depend on, and shakes out the per-provider client wrappers that the round-generation engine will reuse.

Adjacent benefit: it forces us to commit to exact API shapes (model strings, endpoints, header parsing) for both providers, which was the largest "open at integration time" caveat in DD-003.

---

## 2. Goals

1. New users land on the app with no keys → wizard runs → at least one provider is validated → defaults are set → main app loads.
2. OpenAI key paste **automatically detects the user's tier** (Tier 1–5) via rate-limit headers from a small test image generation call.
3. Gemini key paste **validates auth** via a free `list-models` call; user **self-declares** their tier.
4. Defaults (image count, aspect ratio) are configured before exiting the wizard and persisted to localStorage.
5. Wizard is fully resumable — refreshing the page mid-wizard restores progress.
6. Re-clearing all keys returns the user to the wizard.

## 3. Non-goals

- **Settings page** (FR-9) — separate slice. The wizard's components should be designed for reuse in settings, but settings UI itself is out of scope here.
- **Main app UI** — out of scope.
- **History / IndexedDB** — out of scope.
- **Round generation** — out of scope. The OpenAI test-gen call is the *only* round-shaped operation in this slice, and it's narrowly scoped to validation.
- **Animation polish** — `prefers-reduced-motion` honored, but no animated transitions worth designing here.
- **Schema migrations** — localStorage is `vucible:v1`. v2 migration is post-MVP.

---

## 4. User flows

### 4.1 First-time visitor (happy path)

1. User opens `https://vucible.app/`.
2. Root page checks `localStorage["vucible:v1"]`. Not present → renders `<WizardShell>` directly (no `/wizard` redirect — see §9 Routing).
3. **Step 1: Welcome.** Single CTA "Get started →".
4. **Step 2: Add keys.**
   - Two provider cards stacked: OpenAI (top), Gemini (bottom). Recommended-blend banner above both.
   - User pastes OpenAI key. The card shows a **cost-disclosure note above the validate button**: *"Validating an OpenAI key generates one small test image (~$0.04) on your account to detect your usage tier."*
   - User clicks "Validate". Spinner + "Generating test image…". On success: green check, IPM cap shown, tier badge ("Tier 2 — 20 images/min").
   - User pastes Gemini key. Validate is free. On success: tier dropdown ("Free / Tier 1 / Tier 2 / Tier 3") appears beneath. User picks "Tier 1". If user picks "Free", a red `FreeTierWarning` banner appears: *"Free Gemini API tier doesn't include image generation as of Dec 2025. Add billing in AI Studio to enable."*
   - "Continue →" button enables once at least one provider is validated.
5. **Step 3: Defaults.**
   - "Images per round": 4 / 8 / 16 buttons. Caption beneath: *"Your tier supports up to N images/min. 16/round will fit."* If user picks N > IPM cap, show inline note: *"You'll hit your tier cap on this — rounds will queue."*
   - "Aspect ratio": picker form depends on which providers are validated (per DD-023 and §6 below).
6. **Step 4: Confirm.**
   - Summary card: providers, tiers, image-count default, aspect default.
   - "Start using vucible →" button writes the full state to `localStorage["vucible:v1"]` and triggers app-state refresh (the root page re-renders with the main app component instead of the wizard).

### 4.2 First-time visitor (sad paths)

- **Bad OpenAI key** (401/403): test-gen call returns auth error. Card shows red error tile with reason and a "Try again" affordance. User can clear field and re-paste.
- **OpenAI rate limit on validation** (429): unusual on a fresh key. Show *"Rate limited. Wait 30s and retry."* with a countdown that uses `Retry-After` header if present.
- **OpenAI content policy on test prompt** (422): exceedingly rare with our chosen prompt, but possible. Show *"Test prompt blocked. Please report this; meanwhile your key may still be valid — try the main app."* — and let the user proceed using a fallback "validated, tier unknown" state with default cap 5.
- **OpenAI 5xx**: show *"OpenAI had a server error. Try again."* with retry button.
- **Network failure on either**: *"Couldn't reach \<provider\>. Check your connection."*
- **Bad Gemini key** (401/403): list-models returns auth error. Card shows red error tile. User can re-paste.
- **Gemini network failure**: same pattern.
- **User pastes both keys, only one validates**: "Continue →" enables anyway (one is enough). The unvalidated card stays in error state; user can clear and re-add.
- **User refreshes mid-wizard**: state restored from `localStorage["vucible:v1.wizard"]` (a separate scratchpad key — see §6); user resumes at the step they were on.

### 4.3 Returning user (no wizard)

- `localStorage["vucible:v1"]` present and contains ≥1 validated provider → root page renders main app.
- (Out of scope here, but contract: main app reads the same storage shape.)

### 4.4 Cleared keys (wizard re-runs)

- Settings (FR-9) "Clear keys" → wipes `localStorage["vucible:v1"].providers` → wizard component renders again.

---

## 5. Component tree

```
src/app/
  layout.tsx                  -- root layout (theme, fonts, html)
  page.tsx                    -- server shell, renders <WizardOrApp/>
  _components/
    WizardOrApp.tsx           -- "use client" gate: reads storage, renders
                                  <WizardShell/> or <MainAppPlaceholder/>
                                  (master Phase 4 swaps placeholder → <AppShell/>)
  globals.css                 -- (existing)

src/components/
  wizard/
    WizardShell.tsx           -- step state machine, navigation, footer
    StepIntro.tsx             -- welcome copy + "Get started"
    StepKeys.tsx              -- two ProviderCards stacked + recommendation banner
    StepDefaults.tsx          -- ImageCountPicker + AspectRatioPicker
    StepConfirm.tsx           -- summary + "Start using vucible"

    parts/
      ProviderCard.tsx        -- header + KeyPasteField + ValidationStatus
      KeyPasteField.tsx       -- input + paste handler + validate button
      ValidationStatus.tsx    -- spinner / error tile / success badge
      TierBadge.tsx           -- "Tier 2 — 20 IPM" pill
      TierDropdown.tsx        -- Gemini self-declared tier
      FreeTierWarning.tsx     -- red banner for Gemini Free
      RecommendBlend.tsx      -- multi-provider recommendation banner
      CostDisclosure.tsx      -- "~$0.04" cost note above OpenAI validate
      ImageCountPicker.tsx    -- 4/8/16 buttons + tier-aware caption
      AspectRatioPicker.tsx   -- discrete OR freeform, see §6
      DiscreteRatioGrid.tsx   -- visual rectangle buttons for the 10 ratios
      FreeformRatioInput.tsx  -- W × H inputs

  ui/
    (existing shadcn primitives: badge, button, card, dialog, input, label,
     switch, tabs, textarea, toggle-group, toggle)
    -- the wizard slice itself only needs: alert, radio-group, select,
       separator, tooltip. The full master add list (also includes progress,
       scroll-area, sonner for the round/grid/toast surfaces) lives in
       `docs/plans/vucible.md` §3 — install the full master list in master
       Phase 0 so downstream slices don't have to re-add.

src/lib/
  providers/
    types.ts                  -- Provider, Tier, ProviderConfig, AspectRatioConfig types
    openai.ts                 -- testGenerate(key) → { ok, tier, ipm } | { ok:false, error }
    gemini.ts                 -- listModels(key) → { ok } | { ok:false, error }
    tiers.ts                  -- IPM-to-Tier mapping, default IPM caps per tier
    errors.ts                 -- normalized error type + messages

  storage/
    keys.ts                   -- read/write/clear "vucible:v1"
    wizard-progress.ts        -- read/write "vucible:v1.wizard" (scratchpad)
    schema.ts                 -- VucibleStorage v1 shape, parsing/migration stub

  wizard/
    machine.ts                -- WizardState, action types, reducer
    validation.ts             -- key-format pre-checks (sk-..., AIza...)
    copy.ts                   -- centralized strings (see §11)
```

---

## 6. State model & storage schema

### 6.1 Persistent storage — `localStorage["vucible:v1"]`

**Canonical schema is defined in `docs/plans/vucible.md` §5.1.** Do not duplicate the type here — the master plan is the single source of truth and includes fields the wizard doesn't directly touch (`concurrencyCap`, `theme`) but must preserve when writing.

The wizard writes the **full** `VucibleStorageV1` blob on completion. Initial values:
- `providers.{openai,gemini}` from validation results
- `defaults.imageCount` from step 3 selection
- `defaults.aspectRatio` from step 3 selection (must satisfy the §5.1 aspect invariant: discrete if `providers.gemini` is set)
- `defaults.theme = "system"` (sensible default; user can change later in Settings)
- `providers.{openai,gemini}.concurrencyCap = ipm` (default to detected/declared cap; user can adjust later in Settings)
- `createdAt = new Date().toISOString()`
- `schemaVersion = 1`

**Read path:** `getStorage()` → returns `null` if absent or invalid JSON; main page treats that as "show wizard."
**Write path:** `setStorage(s)` writes the full blob (no partial writes; keeps schema integrity simple). Aspect invariant enforced at this seam (see vucible.md §5.1).
**Clear path:** `clearStorage()` removes the key; useful for "Clear all keys" in settings (FR-9).

### 6.2 Wizard scratchpad — `localStorage["vucible:v1.wizard"]`

Separate from the persistent storage so a partial wizard never appears as a "configured" state. Wiped when wizard completes.

```ts
interface WizardProgress {
  step: 1 | 2 | 3 | 4;
  draftProviders: Partial<Record<Provider, {
    apiKey?: string;
    tier?: Tier;
    ipm?: number;
    validatedAt?: string;
    error?: NormalizedError; // last validation error
  }>>;
  draftDefaults?: Partial<UserDefaults>;
}
```

### 6.3 In-memory state (not persisted)

- The validation in-flight flag per provider (so we can show the spinner).
- The actual test-gen image bytes from OpenAI: **discarded immediately**. Per DD-022: "We swallow the test image (do not surface it)." Do not store, do not display.

### 6.3.1 Validate-button double-click prevention

OpenAI test-gen costs ~$0.04 per fire. A user paste-rage-clicking "Validate" must not be billed twice. Defense-in-depth:

1. The Validate button is disabled the instant the click handler fires — `disabled={isValidating}` plus an early-return guard inside the handler.
2. The reducer rejects `validate-start` actions for a provider that is already `validating`.
3. The provider-client `testGenerate(key)` is **not** idempotent across retries (each call costs money). The wizard does NOT auto-retry on transient errors — only the user clicking "Retry" fires another call.
4. **Mid-validation key edit**: while a `testGenerate` call is in flight, the paste field is `readOnly`. User cannot change the key under a running validation — eliminates the "pasted a new key, prior call returned, ambiguous which key was just validated" race. On error, the field unlocks; on success, the field stays read-only with a "Clear" link to start over.
5. The in-flight validation has its own `AbortController`. If the user navigates away (closes tab, hits Back) the controller aborts; if the request had already been billed by the provider, it's still billed — we just stop waiting on it. We do NOT auto-resume on remount.

Manually tested in Phase 7 by inserting a 2-second `setTimeout` shim around the button handler and rage-clicking — only one call fires.

### 6.4 State machine

`useReducer` in `WizardShell.tsx`. Discriminated-union actions:

```ts
type WizardAction =
  | { type: "set-step"; step: 1 | 2 | 3 | 4 }
  | { type: "set-draft-key"; provider: Provider; apiKey: string }
  | { type: "validate-start"; provider: Provider }
  | { type: "validate-success"; provider: Provider; tier: Tier; ipm: number }
  | { type: "validate-error"; provider: Provider; error: NormalizedError }
  | { type: "set-gemini-tier"; tier: Tier }   // user dropdown selection
  | { type: "clear-provider"; provider: Provider }
  | { type: "set-image-count"; count: 4 | 8 | 16 }
  | { type: "set-aspect"; aspect: AspectRatioConfig }
  | { type: "complete" };  // commit to persistent storage and exit
```

Each non-trivial transition writes to `localStorage["vucible:v1.wizard"]` (debounced, ~250ms) so refresh is safe. Don't write on every keystroke — only on validation outcomes and step changes.

---

## 7. API integration details

### 7.1 OpenAI — test image generation for tier detection

**Endpoint:** `POST https://api.openai.com/v1/images/generations`

**Request body:**
```json
{
  "model": "gpt-image-2",
  "prompt": "a single solid color square",
  "size": "1024x1024",
  "n": 1,
  "response_format": "b64_json"
}
```

(Prompt content was the resolved lean from §15.C / master `vucible.md` §14.C — minimal, unambiguous, never triggers safety. Smoke test confirms before Phase 3.)

**Open question** (per DD-003 and §15.A): confirm exact model identifier string at integration time. Candidates we've seen: `gpt-image-1`, `gpt-image-1.5`, `gpt-image-2`. Plan: ship behind a `OPENAI_IMAGE_MODEL` env-default constant in `src/lib/providers/openai.ts` so we can swap without hunting.

**Headers:**
```
Authorization: Bearer <apiKey>
Content-Type: application/json
```

**Success response (200):** body contains `{ data: [{ b64_json: "..." }] }` — discard immediately. The valuable signal is in the **response headers**:
- `x-ratelimit-limit-images` — the IPM cap (number).
- `x-ratelimit-remaining-images` — informational; not used for tier detection.
- `x-ratelimit-reset-images` — informational.

**Tier mapping** (`src/lib/providers/tiers.ts`):
```ts
const IPM_TO_TIER: Record<number, Tier> = {
  5: "tier1",
  20: "tier2",
  50: "tier3",
  100: "tier4",
  250: "tier5",
};

function ipmToTier(ipm: number): Tier {
  if (IPM_TO_TIER[ipm]) return IPM_TO_TIER[ipm];
  // Unknown IPM (provider added a new tier or changed numbers) — pick closest known tier
  // and persist the actual IPM. Tier label is informational; the cap is what we enforce.
  const known = [5, 20, 50, 100, 250];
  const closest = known.reduce((p, c) => Math.abs(c - ipm) < Math.abs(p - ipm) ? c : p);
  return IPM_TO_TIER[closest];
}
```

**If header is missing:** unusual (provider would have to drop the header), but plan: treat as Tier 1 with caveat in UI: *"Tier could not be auto-detected — using Tier 1 default. You can override in Settings later."*

**Error mapping (`src/lib/providers/errors.ts`):**

| HTTP | OpenAI body code | Normalized error | UI message |
|------|---|---|---|
| 401, 403 | `invalid_api_key`, `incorrect_api_key`, etc. | `auth_failed` | "Invalid API key. Re-check and try again." |
| 429 | `rate_limit_exceeded` | `rate_limited` | "Rate limited. Wait {retryAfter}s and retry." |
| 400 | `invalid_request_error` | `bad_request` | "Validation request was malformed (likely a vucible bug). Report this." |
| 422 | `content_policy_violation` | `content_blocked` | "Test prompt blocked by safety filter. Try again or report." |
| 5xx | any | `server_error` | "OpenAI had a server error. Try again." |
| network | — | `network_error` | "Couldn't reach OpenAI. Check your connection." |

`NormalizedError = { kind: ErrorKind; message: string; httpStatus?: number; retryAfterSeconds?: number; raw?: string }`

### 7.2 Gemini — list-models for auth validation

**Endpoint:** `GET https://generativelanguage.googleapis.com/v1/models?key=<apiKey>`

**Open question** (§15.B): exact endpoint + version path may have shifted. `v1` is stable, `v1beta` exposes more models. Plan: hit `v1` for validation (only needs auth, not model presence).

**Success response (200):** `{ models: [...] }`. We don't introspect the list — presence of a 200 is enough.

**No tier in response.** User self-declares (DD-022).

**Error mapping:**

| HTTP | Normalized error | UI message |
|------|---|---|
| 400 with INVALID_ARGUMENT | `auth_failed` | "Invalid API key format." |
| 401, 403 | `auth_failed` | "Invalid API key. Re-check and try again." |
| 429 | `rate_limited` | "Rate limited. Wait a moment and retry." |
| 5xx | `server_error` | "Gemini had a server error. Try again." |
| network | `network_error` | "Couldn't reach Gemini. Check your connection." |

### 7.3 What the wizard does NOT do

- Does not call the round-generation flow.
- Does not store any image bytes anywhere (`b64_json` in the test-gen response is discarded; no IndexedDB writes from wizard).
- Does not validate keys against a regex beyond a basic prefix sanity (`sk-` for OpenAI, `AIza` for Gemini) — real validation is the API call.

---

## 8. Tier detection edge cases

1. **OpenAI Tier 1 quota of 5 IPM is exact-on-first-call.** First test-gen consumes 1, leaves 4. Show *"4/5 remaining this minute"* informationally so user knows they shouldn't run a round immediately. Per DD-016 the throttle handles this anyway; this is just transparency.
2. **Detected tier auto-bumps the concurrency cap default.** If we detect Tier 2 (20 IPM), the **default for the user's per-provider concurrency cap** (lives in storage post-wizard) is set to 20, not 5. The wizard's image-count picker can show a higher max in its caption.
3. **User has multiple OpenAI orgs.** The key is per-org. We don't disambiguate; the rate-limit headers reflect whichever org the key belongs to.
4. **Gemini's "Free tier API = 0 IPM for image gen" warning.** Triggered when the user picks "Free" from the tier dropdown. Validation succeeded (key is real) but image gen won't work. UI must allow them to *complete* the wizard with this state — they may have OpenAI as the active provider. But add a sticky reminder in the confirm step.
5. **User declares Gemini Tier higher than reality.** No way for us to detect lying. They'll just hit 429s in production. The DD-019 failure-handling banner ("Hit your rate limit — upgrade your tier or lower the per-round image count") covers this.

---

## 9. Routing

**Decision: single root page, no `/wizard` route.**

Rationale:
- Wizard is gate, not destination. A separate route would require a redirect-on-mount that's brittle in Next 16's App Router with client-only state (localStorage).
- `src/app/page.tsx` becomes a thin client component: read storage, render `<WizardShell>` if absent or `<MainAppPlaceholder>` if present.
- During the wizard slice, `<MainAppPlaceholder>` is just a "Main app coming soon" panel. Replaced in the next slice.

**Server vs. client rendering:** Wizard is fully client-side because it reads localStorage and calls third-party APIs from the browser per DD-001. The root page should mark itself with `"use client"` *or* split into a thin server shell + a client `<WizardOrApp>` child. Lean toward the latter: keeps SEO-relevant metadata server-rendered and contains client-only logic in the child component.

```
app/page.tsx (server)        — metadata, suspense boundary, renders <WizardOrApp/>
app/_components/WizardOrApp.tsx ("use client") — reads storage, renders wizard or app
```

**Hydration safety:** localStorage isn't available during SSR. Initial client render must match server render to avoid hydration mismatch. Strategy: render a `<WizardLoading/>` skeleton on first paint, then read storage in `useEffect` and re-render. Alternative: use `<NoSSR/>` wrapper. Lean toward the skeleton approach — looks deliberate.

---

## 10. Error states (comprehensive)

| Where | Trigger | UI | Recovery |
|---|---|---|---|
| Step 2 OpenAI card | 401/403 from test-gen | Red error tile inside card, key field cleared | Re-paste, re-validate |
| Step 2 OpenAI card | 429 from test-gen | Yellow warning, countdown using `Retry-After` | Auto-retry button enables when countdown ends |
| Step 2 OpenAI card | 422 content policy | Red tile with explainer | "Skip tier detection, proceed with Tier 1 default" link |
| Step 2 OpenAI card | 5xx | Red tile, generic | "Retry" button |
| Step 2 OpenAI card | Network | Red tile | "Retry" button |
| Step 2 Gemini card | 401/403 from list-models | Red tile | Re-paste, re-validate |
| Step 2 Gemini card | 5xx | Red tile | "Retry" button |
| Step 2 banner | Both providers in error | Single banner: *"Couldn't validate any keys. Re-check and try again."* | inline |
| Step 3 | User picks image count > IPM cap | Inline note (not error): *"You'll hit your tier cap; rounds will queue."* | proceed; not blocking |
| Step 3 | Aspect freeform with W×H out of OpenAI's range (>2560×1440) | Inline note: *"Above OpenAI's recommended range; results may be lower quality."* | proceed; not blocking |
| Step 4 confirm | localStorage write fails (quota) | Toast error, stay on step 4 | Suggest clearing browser storage |
| Anywhere | Unhandled exception | Error boundary inside `<WizardShell>` shows a "Something went wrong, refresh to retry. Your key drafts are saved." | reload |

---

## 11. Copy / UX details

Centralized in `src/lib/wizard/copy.ts` so non-engineers can edit without touching components.

### Step 1 — Welcome
- **Title:** "Welcome to vucible"
- **Body:**
  > A tool for evolving visual ideas through structured rounds of generation and selection.
  >
  > To use vucible you'll need an API key from at least one of OpenAI or Google Gemini. Your keys are stored only in your browser — we never see them.
- **CTA:** "Get started →"

### Step 2 — Add keys

- **Header:** "Add your provider keys"
- **Recommend banner** (shown above both cards):
  > **Use both for better results.** OpenAI and Gemini are built differently and produce more diverse outputs together. vucible's evolution loop benefits from cross-model variance.

- **OpenAI card:**
  - Title: "OpenAI"
  - Subtitle: "gpt-image-2 — high quality, arbitrary aspect ratios"
  - "Get an API key →" link → `https://platform.openai.com/api-keys` (target=_blank, rel=noopener)
  - Cost disclosure (above paste field): *"Validating triggers one small test image (~$0.04) on your account to detect your usage tier."*
  - Input placeholder: `sk-...`
  - Validate button label: "Validate"
  - During validation: spinner + "Generating test image…"
  - On success: green check + `<TierBadge>` (e.g. "Tier 2 — 20 images/min") + "Clear" link

- **Gemini card:**
  - Title: "Google Gemini"
  - Subtitle: "Gemini 3 Pro Image — supports image references"
  - "Get an API key →" link → `https://aistudio.google.com/app/apikey`
  - Input placeholder: `AIza...`
  - Validate button: "Validate"
  - On success: green check + `<TierDropdown>` ("What tier is this account?") with options Free / Tier 1 / Tier 2 / Tier 3
  - If "Free" picked: red banner inside card:
    > **Free Gemini API tier doesn't include image generation as of Dec 2025.** Add billing in [AI Studio](https://aistudio.google.com/app/billing) to enable image generation.

- **Continue button:** "Continue →" — disabled until ≥1 provider validated.

### Step 3 — Defaults

- **Header:** "Set your starting preferences"
- **Subtitle:** "These are defaults; you can change them per round later."

- **Image count:**
  - Label: "Images per round"
  - Three buttons: 4 / 8 / 16
  - Caption beneath:
    - If both providers active: *"Default cap: {min(openaiIpm, geminiIpm)}/min combined. {N}/round will fit."* (with model-split note: "split evenly across providers")
    - If single provider: *"{provider} cap: {ipm}/min. {N}/round will fit."*
    - If user picks N > cap: *"You'll hit your cap on this — rounds will queue."*

- **Aspect ratio:**
  - Label: "Aspect ratio"
  - Picker form per DD-023:
    - Both providers OR Gemini only → `<DiscreteRatioGrid/>` showing 10 ratios as visual rectangle buttons (1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9)
    - OpenAI only → `<FreeformRatioInput/>` with two number inputs (W × H), with "Quick presets" toggle that reveals the same 10 discrete buttons
  - Default: 1:1 (square)

- **Continue button:** "Continue →"

### Step 4 — Confirm

- **Header:** "All set?"
- **Summary card:**
  - Providers: shown as badges with tiers (e.g. "OpenAI · Tier 2 (20 IPM)", "Gemini · Tier 1 (10 IPM)")
  - Default image count: e.g. "16 per round"
  - Default aspect: e.g. "1:1 (square)" or "1280 × 512 (≈ 5:2)"
- **Sticky reminder (if applicable):** if Gemini was added with Free tier, *"Note: Gemini Free tier won't generate images. Disable Gemini per round, or upgrade billing."*
- **Final CTA:** "Start using vucible →"

### Footer (every step)

- Step indicator: "Step 2 of 4"
- "Back" button (steps 2–4)
- Subtle exit hint on step 1 only: nothing — there's no exit. Per DD-017: no escape hatch.

---

## 12. Implementation order (consumed by beads-workflow)

Each item below is a candidate for `br create`. They're sequenced to surface integration risk early (provider clients first, UI second).

> **Relationship to the master plan.** When following `docs/plans/vucible.md` end-to-end, this wizard's Phase 0–2 are subsumed by master Phases 0–2 (master Phase 2 is a superset: it includes `generate()` and `failures.ts`, which the wizard doesn't strictly need but downstream phases do). What's listed below as Phase 3 onwards becomes the work inside master Phase 3 (the "build the wizard" phase). Phase numbering here is preserved for the standalone case where someone wants to ship only the wizard.

### Phase 0 — Scaffold deps (30 min)
1. Install shadcn primitives. **If running the wizard slice in isolation:** `alert`, `radio-group`, `select`, `separator`, `tooltip`. **If running inside the master plan flow:** install the full master list per `docs/plans/vucible.md` §3 (adds `progress`, `scroll-area`, `sonner`) — master is authoritative on the full add list.
2. Add a `docs/plans/` directory pointer to AGENTS.md (or accept it as convention).

### Phase 1 — Types + storage (1 hr)
3. `src/lib/providers/types.ts` — define `Provider`, `Tier`, `ProviderConfig`, `AspectRatioConfig`, `UserDefaults`, `NormalizedError`, `ErrorKind`.
4. `src/lib/storage/schema.ts` — `VucibleStorageV1` with parse/validate (use `zod` or hand-rolled — lean hand-rolled for one schema).
5. `src/lib/storage/keys.ts` — `getStorage()`, `setStorage(s)`, `clearStorage()`.
6. `src/lib/storage/wizard-progress.ts` — `getProgress()`, `setProgress(p)`, `clearProgress()`, with debounced setter helper.
7. Unit tests for storage round-trips and schema rejection.

### Phase 2 — Provider clients (2 hr)
8. `src/lib/providers/tiers.ts` — IPM↔tier mapping + `ipmToTier(n)` with unknown-value fallback.
9. `src/lib/providers/errors.ts` — normalized error types + per-provider error message mapping.
10. `src/lib/providers/openai.ts` — `testGenerate(key)` with header parsing for tier detection.
11. `src/lib/providers/gemini.ts` — `listModels(key)` for auth validation.
12. **Manual smoke test:** call both clients from a quick script with real keys to confirm endpoints and header shapes (this is the highest-risk integration step; do it before building UI).
13. Unit tests with `msw` mocking the provider endpoints (success, 401, 429, 5xx).

### Phase 3 — Wizard state machine (1 hr)
14. `src/lib/wizard/machine.ts` — `WizardState`, `WizardAction`, `wizardReducer(state, action)`.
15. `src/lib/wizard/validation.ts` — key-format pre-checks.
16. `src/lib/wizard/copy.ts` — centralized strings.
17. Unit tests for reducer transitions.

### Phase 4 — UI components (3 hr)
18. `<WizardShell/>` — useReducer + step navigation + progress persistence.
19. `<StepIntro/>` — straight markup.
20. `<ProviderCard/>` — paste field, validate handler wiring to provider clients, validation status display.
21. `<KeyPasteField/>`, `<ValidationStatus/>`, `<TierBadge/>`, `<TierDropdown/>`, `<FreeTierWarning/>`, `<RecommendBlend/>`, `<CostDisclosure/>`.
22. `<StepKeys/>` — composes the two `ProviderCard`s + recommend banner.
23. `<ImageCountPicker/>`, `<AspectRatioPicker/>`, `<DiscreteRatioGrid/>`, `<FreeformRatioInput/>`.
24. `<StepDefaults/>` — composes pickers, tier-aware captions.
25. `<StepConfirm/>` — summary card, free-tier reminder, final CTA.
26. Component tests with React Testing Library: each step renders correctly, button enables/disables as expected.

### Phase 5 — Routing + integration (1 hr)
27. `src/app/page.tsx` — server component shell.
28. `src/app/_components/WizardOrApp.tsx` — client gate; reads storage; renders wizard or `<MainAppPlaceholder/>`.
29. `src/components/MainAppPlaceholder.tsx` — minimal placeholder for "next slice goes here."
30. Hydration test: ensure initial paint matches server render.

### Phase 6 — Error boundary + polish (1 hr)
31. `<WizardErrorBoundary/>` wrapping `<WizardShell/>`.
32. Verify all sad paths from §10 trigger the right UI.
33. Accessibility pass: focus management on step transitions, `aria-live` on error tiles, keyboard navigation through provider cards and pickers.

### Phase 7 — End-to-end manual + automated (1 hr)
34. Manual: full wizard with real OpenAI + Gemini keys.
35. Manual: bad key, server error, network drop (block with devtools).
36. Playwright (or vitest + JSDOM) E2E covering happy path + 1 sad path with mocked APIs.
37. `ubs` on changed files; `bun run build`; `bun run lint`.

**Total estimate: ~10 hours** of focused implementation across phases. Integration risk is concentrated in Phase 2 (provider clients) — surface early, defer UI work behind it.

---

## 13. Test plan

### Unit
- Storage: round-trip, schema reject, missing keys → `null`.
- Provider clients: each error class produces the right `NormalizedError` (mocked HTTP).
- Reducer: every action transitions state correctly; idempotent on duplicates.
- Tier mapping: known IPM → tier; unknown IPM → closest known tier.

### Component (RTL)
- `<ProviderCard/>` shows correct UI for each validation state.
- `<StepKeys/>` continue button enables on first validated provider.
- `<AspectRatioPicker/>` form changes with model toggle.
- `<FreeTierWarning/>` shows on Free dropdown selection.

### Integration / E2E
- Happy path: complete wizard with both keys → main app placeholder appears.
- Sad path: bad OpenAI key → re-paste → success → continue.
- Refresh mid-wizard → resume on same step with drafts preserved.

### Manual
- Real OpenAI key on Tier 1: tier detected as Tier 1.
- Real OpenAI key on Tier 2+: tier detected, IPM shown.
- Real Gemini key (paid tier): validates; pick Tier 1; warning shown if accidentally picking Free.
- Refresh after wizard completion: lands on main app placeholder, not wizard.
- Clear `localStorage["vucible:v1"]` in devtools: wizard re-appears on refresh.

---

## 14. Out of scope (explicit)

- **The actual main app** — `<MainAppPlaceholder/>` is a 5-line component for now.
- **Settings page** (FR-9) — separate slice; this slice's components must be designed for reuse there.
- **Multi-language / i18n** — copy is hardcoded English in `copy.ts`. Refactor for i18n is a future project.
- **Analytics / telemetry** — no event tracking from the wizard. Per DD-001 we have no backend; client-side analytics is a separate decision.
- **Account import / migration from another tool** — out of scope.
- **Storage encryption** — keys are in plain `localStorage`. Documented risk in DD-001. Not changing here.
- **"Test connection" via list-models for OpenAI** — chose test-gen because tier detection is required, and DD-022 made the cost trade-off.

---

## 15. Open questions (block implementation if unresolved)

### A. OpenAI image model identifier

DD-003 wrote "gpt-image-2"; web search saw "gpt-image-1", "gpt-image-1.5", and "gpt-image-2" all in the wild. Need to **confirm exact model string** against current OpenAI API docs before Phase 2. Default constant location: `OPENAI_IMAGE_MODEL` in `src/lib/providers/openai.ts`. Confirmation method: hit the OpenAI models list endpoint with our key and look for `gpt-image-*` entries.

### B. Gemini image model + endpoint version

DD-003 wrote "Gemini 3.1 Pro Preview"; web search showed "Nano Banana Pro" and "Gemini 3 Pro Image". Need to **confirm exact model string and endpoint version** (`v1` vs `v1beta`). Confirmation method: hit the Gemini models list endpoint with our key.

### ~~C. Test-gen prompt content~~ — RESOLVED

Locked: `"a single solid color square"`. Minimal, unambiguous, never triggers safety. Phase 2 smoke test verifies no 422 on any tier (per §10 OpenAI 422 row).

### D. Storage corruption recovery

If `localStorage["vucible:v1"]` exists but is malformed JSON or fails schema validation, current plan: treat as missing → wizard runs. Alternative: show a "Storage corrupted, re-enter your keys" banner in the wizard. Decision lean: latter, because silently re-entering keys without explanation is alarming. Add a bullet to step 1 if corruption detected.

### E. Tier-detect "skip" affordance on 422

If OpenAI's content-policy filter blocks the test-gen (extremely unusual), do we let the user proceed with key marked validated-but-tier-unknown? Plan says yes (use Tier 1 default). Confirm: that's acceptable UX, not a hard stop.

### F. Hydration approach

Server-shell + client-gate (lean) vs. `"use client"` on the entire page (simpler). Confirm before Phase 5. Lean: server-shell preserves any future SSG-shaped behavior (OG tags, etc.).

### G. Test framework

`vitest` (Next 16's recommended) vs. `jest`. Lean: vitest. Confirm before Phase 1's first test file.

---

## 16. Dependencies on other planning slices

- **Settings page (FR-9)** depends on this slice for: storage schema, ProviderCard component reuse, validation flow reuse. Settings slice should consume this directly.
- **Round-generation engine (FR-2/3)** depends on this slice for: `ProviderConfig` (key + IPM cap), `AspectRatioConfig`, image-count default. The provider clients here (`openai.ts`, `gemini.ts`) will gain new functions (`generate`, `listModels`-for-something-else) but the auth + tier-detect portions are reusable.
- **Failure handling (FR-10 / DD-019)** is implicit here in Phase 6's error boundary but the *retry-3x with exponential backoff* part lives in the round engine, not wizard. Wizard's validation calls don't auto-retry — user explicitly clicks retry.

---

## 17. Acceptance criteria

The wizard slice is "done" when:

1. New user with empty localStorage can complete the wizard end-to-end with at least one real provider key, ending in the main app placeholder.
2. OpenAI tier is auto-detected from real test-gen response headers; user sees the correct IPM cap.
3. Gemini key validation succeeds via list-models; user picks a tier.
4. All sad paths from §10 produce the documented UI behavior.
5. Refresh during the wizard preserves draft state.
6. Storage cleared in devtools → wizard re-runs on refresh.
7. `bun run build` succeeds, `bun run lint` clean, `ubs` clean on changed files.
8. At least the unit + component tests from §13 pass; manual happy path + 1 sad path verified.

---

## 18. Review notes for round 2

This is a **round-1 draft**. Per the planning-workflow methodology, recommended next steps:

1. **Self-review pass** (Claude reading own work after a break) for inconsistencies and missing dependencies.
2. **Extended-reasoning review** via the planning-workflow's exact GPT-Pro prompt against the full text — looking for gaps in the state machine, missing error states, edge cases in tier detection.
3. **Optional multi-model blend**: Gemini 3 Pro Deep Think and Grok 4 review for adversarial gaps.
4. **Convert to beads** via beads-workflow once this plan is at steady-state — each item in §12 becomes a bead with the correct dependencies.

---

## 19. Glossary

- **BYOK** — Bring Your Own Key. User provides API keys; we never proxy or store server-side. (DD-001)
- **IPM** — Images Per Minute. The rate-limit dimension that throttles parallel image gen calls. (DD-016)
- **Tier** — OpenAI's usage-graduated rate-limit class (Tier 1 → Tier 5).
- **Test-gen** — A small image generation call used solely to validate auth and detect tier. The image is discarded.
- **Wizard scratchpad** — the `vucible:v1.wizard` localStorage key holding partial progress mid-wizard. Wiped on completion.
