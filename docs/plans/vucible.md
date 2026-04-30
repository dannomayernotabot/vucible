# Vucible — Master Implementation Plan

> **Status:** Round 7 (handoff readiness — final round)
> **Date:** 2026-04-27
> **Scope:** Entire app, v1. Sits *above* `docs/PRD.md` (the WHAT) and `docs/DESIGN_DECISIONS.md` (the WHY) as the HOW — integration shapes, file paths, data flows, sequencing.
> **Companion plans:**
> - `docs/plans/wizard.md` — detailed plan for FR-8 (referenced from §10.2 below; not duplicated here). On any conflict between this master plan and `wizard.md`, **this master plan is authoritative**.
>
> This plan is the source of truth for handoff to `beads-workflow`. Each numbered sub-bullet in §11 (Implementation Phases) becomes one `br create` candidate. When a sub-bullet bundles "build the thing + tests + UI", split it on conversion. See §11 narrative notes per phase for hidden dependencies that are not in the sub-bullet list and must be tracked as bead deps (e.g. BFCache listener landing in Phase 6 not Phase 4 per §14.AC).

---

## 1. What is vucible (one paragraph)

Vucible — short for *Visualization Crucible* — is a browser-only tool for evolving a vague visual idea into a refined image through structured rounds of generation and selection. The user types a general prompt, receives 4/8/16 image options generated in parallel from OpenAI's gpt-image-2 and/or Google's Gemini 3 Pro Image, picks 1–4 favorites with optional commentary, and the next round generates fresh variations seeded by those references plus the original prompt and the user's accumulated commentary. Each round runs in a fresh model context to avoid the "groove" problem where repeated turns in a single chat thread converge on a narrow visual neighborhood. Keys are BYOK and live only in the user's browser; we have no backend.

For the full product spec see [`PRD.md`](../PRD.md). For the architectural decisions see [`DESIGN_DECISIONS.md`](../DESIGN_DECISIONS.md).

---

## 2. Architecture overview

### 2.1 Shape

```
┌────────────────────────────────────────────────────────┐
│  Browser (the entire app lives here)                   │
│                                                        │
│  ┌──────────────┐  ┌────────────────────────────────┐  │
│  │ React/Next   │  │ Storage                        │  │
│  │ App Shell    │◄─┤ - localStorage[vucible:v1]     │  │
│  │              │  │ - IndexedDB[vucible-history]   │  │
│  │              │  └────────────────────────────────┘  │
│  │              │                                      │
│  │              │  ┌────────────────────────────────┐  │
│  │              │  │ Provider clients                │  │
│  │              │──┤ - openai.ts (HTTPS)            │──┼─→ api.openai.com
│  │              │  │ - gemini.ts (HTTPS)            │──┼─→ generativelanguage.googleapis.com
│  │              │  └────────────────────────────────┘  │
│  │              │                                      │
│  │              │  ┌────────────────────────────────┐  │
│  │              │  │ Round engine                    │  │
│  │              │──┤ - throttle (per-provider)      │  │
│  │              │  │ - retry (3x, backoff)          │  │
│  │              │  │ - prompt builder (DD-015)      │  │
│  │              │  │ - stream into grid             │  │
│  │              │  └────────────────────────────────┘  │
│  └──────────────┘                                      │
└────────────────────────────────────────────────────────┘
```

### 2.2 Decisions implementing the architecture

| Concern | Decision | Source |
|---|---|---|
| Backend? | None. Pure browser. | DD-001 |
| Stack | Next.js 16 App Router, TS, Tailwind v4, shadcn/ui | DD-002 |
| Models | OpenAI gpt-image-2 + Gemini 3 Pro Image | DD-003 |
| Persistence | localStorage for keys/defaults; IndexedDB for round history | DD-004, DD-021 |
| Round 2+ semantics | Image refs + original prompt + full commentary trail | DD-005, DD-015 |
| Round 1 | Same prompt N times, trust variance | DD-006 |
| Image counts | 4 / 8 / 16 split evenly across enabled providers | DD-007 |
| Selection | 1–4 favorites + optional commentary | DD-008 |
| Streaming | Cards render as they complete | DD-009 |
| History | Linear, no branching | DD-010 |
| Param UI | Aspect ratio: yes (DD-023). Other params: prompt only. | DD-011 (amended) |
| Grid layout | Two stacked sections grouped by model | DD-012 |
| External guides | Defer to docs/best-practices when in doubt | DD-013 |
| Free tier | Considered, rejected | DD-014 |
| Concurrency | Per-provider throttle, tier-bound | DD-016 |
| Setup wizard | Required first-run | DD-017 |
| Settings page | Mirrors wizard + advanced | DD-018 |
| Failure handling | Retry 3x retryables, settle round, click-to-regen failed | DD-019 |
| Deploy | Vercel, static export | DD-020 |
| Key validation | List-models cheap path; OpenAI test-gen for tier detect | DD-022 |
| Aspect ratio | UI control, provider-aware (discrete for Gemini, freeform when OpenAI-only) | DD-023 |

### 2.3 Module boundaries

```
src/
├── app/                       # Next App Router pages (server-shell + client gates)
│   ├── layout.tsx             # root layout, theme provider, fonts
│   ├── page.tsx               # server shell → renders <WizardOrApp/>
│   ├── globals.css            # Tailwind base + shadcn theme tokens
│   └── _components/
│       └── WizardOrApp.tsx    # client gate: storage check → wizard | main app
│
├── components/
│   ├── ui/                    # shadcn primitives (existing + add: alert, radio-group, select, separator, tooltip, progress)
│   │
│   ├── wizard/                # FR-8 (see docs/plans/wizard.md)
│   │   └── ...
│   │
│   ├── settings/              # FR-9 — reuses ProviderCard/AspectRatioPicker/ImageCountPicker from wizard
│   │   ├── SettingsDialog.tsx
│   │   ├── KeysPanel.tsx
│   │   ├── DefaultsPanel.tsx
│   │   ├── ConcurrencyPanel.tsx
│   │   ├── HistoryPanel.tsx       # Clear history (DD-021)
│   │   └── ProviderDocLinks.tsx
│   │
│   ├── round/                 # the live round UI
│   │   ├── PromptArea.tsx     # prompt input + ModelToggle + AspectPicker + ImageCountPicker
│   │   ├── useRoundForm.ts    # local useReducer over the prompt form (FR-4 + FR-11 + image count)
│   │   ├── ModelToggle.tsx    # FR-4
│   │   ├── ImageCountPicker.tsx
│   │   ├── AspectRatioPicker.tsx  # shared with wizard/settings (FR-11 / DD-023)
│   │   ├── GenerateButton.tsx
│   │   ├── NewSessionButton.tsx   # appears once ≥1 round settled (§10.4 / §14.N)
│   │   └── CommentaryInput.tsx     # round 2+ optional text
│   │
│   ├── grid/                  # FR-5
│   │   ├── ResultGrid.tsx     # two stacked sections per DD-012
│   │   ├── ModelSection.tsx   # one section per provider with header
│   │   ├── ImageCard.tsx      # loading | success | error states
│   │   ├── ImageCardError.tsx # per-error-type message + Regenerate (DD-019)
│   │   ├── ImageCardLoading.tsx
│   │   ├── ImageCardSuccess.tsx
│   │   ├── SelectionOverlay.tsx
│   │   └── ImageZoom.tsx      # full-size view modal
│   │
│   ├── history/               # FR-6
│   │   ├── HistoryRail.tsx    # left/right rail with round navigation
│   │   ├── RoundCard.tsx      # mini view of past round
│   │   └── ScrollBackPanel.tsx
│   │
│   ├── shell/
│   │   ├── AppShell.tsx       # main app layout
│   │   ├── TopBar.tsx         # logo, settings button, history toggle
│   │   └── ThemeToggle.tsx    # dark/light/system
│   │
│   └── feedback/
│       ├── Toast.tsx          # error toasts, info messages
│       └── RateLimitBanner.tsx  # 3-consecutive-429 banner (DD-019)
│
├── lib/
│   ├── providers/             # OpenAI + Gemini client wrappers
│   │   ├── types.ts           # Provider, Tier, ProviderConfig, etc.
│   │   ├── tiers.ts           # IPM ↔ Tier mapping
│   │   ├── errors.ts          # NormalizedError
│   │   ├── openai.ts          # testGenerate, generate, models
│   │   └── gemini.ts          # listModels, generate
│   │
│   ├── round/                 # generation orchestration
│   │   ├── prompt.ts          # DD-015 prompt template builder (round-2 vs round-N templates)
│   │   ├── throttle.ts        # per-provider concurrency queue (DD-016)
│   │   ├── retry.ts           # 3x with Retry-After + exp backoff (DD-019)
│   │   ├── orchestrate.ts     # split call slate, fan out, stream, settle, batched persist
│   │   ├── prepare-references.ts  # single-encode shared across N parallel calls (§10.5)
│   │   ├── image-cache.ts     # ImageCache + ThumbnailCache: refcounted, LRU object-URL lifecycle
│   │   └── failures.ts        # NormalizedError → user copy + useErrorToast hook + isRetryable/isAuth/isContentBlocked predicates
│   │
│   ├── storage/
│   │   ├── schema.ts          # VucibleStorageV1 + IndexedDB schemas + version
│   │   ├── keys.ts            # localStorage[vucible:v1] read/write/clear
│   │   ├── wizard-progress.ts # localStorage[vucible:v1.wizard] scratchpad
│   │   ├── history.ts         # IndexedDB CRUD: rounds, sessions
│   │   └── purge.ts           # Clear-history helper (DD-021)
│   │
│   ├── wizard/                # state machine for the wizard (FR-8)
│   │   ├── machine.ts
│   │   ├── validation.ts
│   │   └── copy.ts
│   │
│   ├── theme/
│   │   └── tokens.ts          # zinc-base palette, spacing scale
│   │
│   └── utils.ts               # shadcn-provided cn() helper (existing)
│
└── types.ts                   # global cross-cutting types (re-exports from lib/*)
```

---

## 3. Stack — concrete pinning

| Tool | Version (pinned in package.json or runtime) | Notes |
|---|---|---|
| Next.js | 16.2.4 (already installed) | App Router, `output: 'export'` for static deploy (DD-020). AGENTS.md flags breaking changes vs. training data — consult `node_modules/next/dist/docs/` before writing Next-y code. |
| React | 19.2.4 | latest stable in scaffold |
| TypeScript | 5+ | strict mode, no `any` unless commented |
| Tailwind | 4 (PostCSS plugin) | scaffold default |
| shadcn/ui | 4.5+ | already installed primitives: badge, button, card, dialog, input, label, switch, tabs, textarea, toggle-group, toggle. **Need to add:** alert, radio-group, select, separator, tooltip, progress, scroll-area, sonner. NOTE: shadcn 4.5 is **base-ui-backed** (`@base-ui/react` already in deps); some primitives have different default behavior vs. the older Radix-backed shadcn — verify each one renders and is keyboard-accessible after install. `sonner` is added via `bunx shadcn@latest add sonner` (generates a `<Toaster/>` component wrapping the `sonner` npm package). The `wizard.md` plan §5 lists a shorter add list (no progress/scroll-area/sonner) — defer to this list as authoritative; wizard.md will be aligned in a follow-up. |
| icons | lucide-react | already in scaffold |
| package manager | bun | per AGENTS.md — never npm/yarn/pnpm |
| linting | eslint (next core-web-vitals) | scaffold default |
| testing | vitest + @testing-library/react + jsdom | confirm in §12. **jsdom does not implement IndexedDB** — see `fake-indexeddb` below. |
| IndexedDB polyfill (tests) | `fake-indexeddb` | required: jsdom has no IndexedDB. Import `fake-indexeddb/auto` in `vitest.setup.ts`; without this every storage/history test errors with "indexedDB is not defined". Non-negotiable. |
| E2E | playwright | confirm in §12. Static export served via `bunx serve out/` for CI runs. |
| HTTP mocking | msw v2 | for unit tests of provider clients. v2 uses native `fetch`/`Request`/`Response` interceptors; **node-mode setup** lives in `vitest.setup.ts` via `setupServer(...)`. Browser-mode (service worker) is only needed if E2E tests want to mock against a real browser — defer. |
| IndexedDB wrapper | `idb` (Jake Archibald) | tiny promise wrapper; avoids hand-rolled callback hell. Note `idb` uses the global `indexedDB` so the polyfill above must be imported *before* any `idb` import in test files. |
| state for round flow | local `useReducer` per slice; `zustand` if cross-component sharing emerges | start with useReducer; resist zustand until needed |

**Why not Redux Toolkit / TanStack Query / Jotai etc.** — none of those buy us anything for a BYOK SPA where there's no shared remote cache and no complex normalized state. Rounds are sequential and naturally local. Settings + keys are read once and rarely mutate. Adding state libs is cost without payoff at MVP.

---

## 4. End-to-end user flows

### 4.1 First-time visitor

1. Land on `/`. Server renders shell + a `<WizardOrApp/>` boundary.
2. `<WizardOrApp/>` (client) reads `localStorage["vucible:v1"]`. Absent → renders `<WizardShell/>`.
3. Wizard runs (per FR-8 / `docs/plans/wizard.md`).
4. On wizard completion, full storage is written, `<WizardOrApp/>` re-renders with `<AppShell/>`.

### 4.2 Returning visitor with keys

1. Land on `/`. Storage present → `<AppShell/>` renders.
2. Top bar: logo (left), `<HistoryRail/>` toggle, `<ThemeToggle/>`, settings gear (right).
3. Center: `<PromptArea/>` (prompt textarea, model toggle, aspect picker, image-count picker, "Generate" button).
4. Below prompt: result grid (empty until first round).

### 4.3 Generating round 1

1. User types prompt: *"new logo for Project X, see brief"*.
2. Adjusts model toggle (default both), aspect (default 1:1), image count (default = wizard preference).
3. Clicks "Generate". Aspect picker locks for the round (can't change mid-round).
4. Round engine:
   - Builds the call slate: `count` total, split evenly across enabled providers.
   - Fans out into per-provider throttle queues (DD-016 caps).
   - Each call independent (fresh context per DD-005).
   - Streams results into the grid as each completes (DD-009).
5. As cards arrive: they slide in with the chosen aspect; section headers (OpenAI / Gemini) per DD-012.
6. Failures show error tiles with reason + Regenerate (DD-019).
7. Round settles when all 16 are terminal (success or failed-after-retries).
8. Selection unlocks: user can click 1–4 favorites, optionally types commentary in `<CommentaryInput/>`.
9. Clicks "Evolve" → round 2 begins.

### 4.4 Generating round 2+

1. Round engine builds prompt per DD-015 round-2 or round-N template (`src/lib/round/prompt.ts`).
2. Sends original prompt + commentary history + selected reference images + evolve directive.
3. Same fan-out as round 1.
4. Aspect ratio carries forward by default; can be overridden for this round.
5. On settle: user picks 1–4 again or starts a fresh prompt to begin a new session.

### 4.5 Looking back at history

1. User clicks `<HistoryRail/>` toggle → side rail expands.
2. Shows past rounds in this session (linear, oldest at bottom or top — TBD §14).
3. Clicking a round in the rail scrolls that round into the main canvas (read-only — DD-010 says no jumping back to fork).
4. History persists in IndexedDB across browser sessions.

### 4.6 Opening settings

1. User clicks gear icon in top bar.
2. `<SettingsDialog/>` opens (Dialog primitive, full-height side sheet variant).
3. Tabs/sections: Keys / Defaults / Concurrency / History.
4. Changes saved on field blur or explicit Save (TBD §14). Lean: explicit Save with a sticky footer per panel.
5. "Clear history" button in History panel → confirm dialog → wipes IndexedDB.
6. "Clear all keys" → wipes `localStorage["vucible:v1"]` → app reloads to wizard.

### 4.7 Hitting a rate limit

1. During a round, 3 consecutive 429s on the same provider trigger `<RateLimitBanner/>` (DD-019).
2. Banner: *"Hit your gpt-image-2 rate limit. Lower the per-round image count or upgrade your OpenAI tier — link."*
3. Round continues to settle as best it can; user can manually click "Regenerate" on failed cards or wait for the throttle queue to drain.

### 4.7.1 Long-round expectation surfacing (low-tier latency)

At Tier 1 (5 IPM) on both providers with a 16-image round, the queue alone takes ~3.2 minutes to drain (16/5) before any individual gen latency. Without a UX signal the user reasonably believes the app is broken. `<ResultGrid/>` shows an estimated-completion banner once the round starts: *"Tier 1 throttle: estimated 3 min for queue. Lower the per-round count in the prompt area for faster rounds."* Estimate = `ceil(slot_count / ipm) * 60s + p50_gen_latency`. Updates live as cards settle. Uses a static 18 s p50 for gen latency until we have real data.

### 4.8 Provider goes down (5xx storms)

1. All in-flight calls to that provider fail through retry-3x.
2. All cards in that provider's section show error tiles.
3. User can: (a) regenerate individual cards (continues to fail), (b) toggle that provider off and try again, (c) wait.

### 4.9 Storage hits quota

1. IndexedDB write fails with QuotaExceededError.
2. Toast: *"Browser storage full. Clear history in settings to make room."* (DD-021)
3. Round still completes in memory; just isn't persisted. User can save individual images via right-click.

---

## 5. Data model

### 5.1 `localStorage["vucible:v1"]` (defaults + keys)

```ts
type Provider = "openai" | "gemini";
type Tier = "free" | "tier1" | "tier2" | "tier3" | "tier4" | "tier5";

interface ProviderConfig {
  apiKey: string;
  tier: Tier;
  ipm: number;         // detected (OpenAI) or declared-derived (Gemini)
  concurrencyCap: number; // = ipm by default; user-adjustable in settings, ≤ ipm
  validatedAt: string; // ISO-8601
}

type AspectRatioConfig =
  | { kind: "discrete"; ratio: GeminiSupportedRatio }
  | { kind: "freeform"; width: number; height: number };

type GeminiSupportedRatio =
  | "1:1" | "3:2" | "2:3" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";

interface UserDefaults {
  imageCount: 4 | 8 | 16;
  aspectRatio: AspectRatioConfig;
  theme: "system" | "dark" | "light";
}

interface VucibleStorageV1 {
  schemaVersion: 1;
  providers: Partial<Record<Provider, ProviderConfig>>;
  defaults: UserDefaults;
  createdAt: string;
}
```

**Invariant: aspect normalization.** When `providers.gemini` is set (Gemini enabled), `defaults.aspectRatio.kind` MUST be `"discrete"`. The freeform variant is only legal when Gemini is absent. Enforced at write time in `setStorage()` — if a freeform aspect is being written while Gemini is configured, snap to nearest supported ratio (DD-023) before persist. Same invariant on the per-round `Round.aspect` field (§5.3) — enforce in `startRound*`.

The invariant is **one-way**: a `discrete` aspect is *always* legal regardless of provider config (it's a strict subset). Snapping logic must only fire on `freeform → has-Gemini` transitions, never on `discrete → discrete` swaps or on toggles when the current value is already `discrete`. Defensive code that "always re-snaps on storage write" would be wasted work and could spuriously change a user's selection.

### 5.2 `localStorage["vucible:v1.wizard"]` (scratchpad)

See `docs/plans/wizard.md` §6.2.

### 5.3 IndexedDB — `vucible-history` database, version 1

Two object stores:

#### IDs

All `id` fields use **ULID** (lexicographically sortable, 26-char base32, encodes timestamp). Library: `ulid` (npm, ~1 KB, no deps). Helper `generateId()` lives in `src/lib/storage/schema.ts` and is the single source of truth for ID generation. We do not use `crypto.randomUUID()` (it's UUID v4 — not time-sortable, which breaks our "most recent" indexes).

**Monotonic factory required.** Plain `ulid()` can produce duplicate IDs when called multiple times within the same millisecond (random component is reseeded per call). Round orchestration generates the round ID and may generate sub-IDs for slots in a tight burst — well within a single ms. Use `monotonicFactory()` from the `ulid` package; `generateId()` wraps a module-level `monotonic = monotonicFactory()` instance so successive calls in the same ms produce strictly increasing IDs without randomness collision risk.

#### `sessions` — one entry per starting prompt

```ts
interface Session {
  id: string;          // ULID
  startedAt: string;   // ISO-8601
  originalPrompt: string;
  // The chronological list of round IDs; determines history rail order.
  roundIds: string[];
}
```

Indexes:
- `by_startedAt` (sortable for "most recent sessions" lookup)

#### `rounds` — one entry per generated round

```ts
type RoundResult =
  | {
      status: "success";
      bytes: ArrayBuffer;          // full-resolution image
      thumbnail: ArrayBuffer;      // ≤ 320×320 JPEG ~30 KB; generated on settle
      mimeType: string;            // "image/png" | "image/jpeg" | "image/webp"
      meta: ImageMeta;
    }
  | { status: "error"; error: NormalizedError };

interface Round {
  id: string;            // ULID
  sessionId: string;     // FK to Session
  number: number;        // 1, 2, 3, ...
  promptSent: string;    // the actual prompt sent to providers (for round 2+, this is the templated DD-015 string)
  modelsEnabled: { openai: boolean; gemini: boolean };
  imageCount: 4 | 8 | 16;
  aspect: AspectRatioConfig;     // invariant: discrete if modelsEnabled.gemini
  // Parallel per-provider arrays — matches the grid's two-section layout (DD-012).
  // Provider is implicit by which array a result lives in (no per-result discriminator).
  // Lengths sum to imageCount; either may be empty if the provider was disabled for this round.
  openaiResults: RoundResult[];
  geminiResults: RoundResult[];
  selections: { provider: Provider; index: number }[];   // up to 4 (DD-008)
  commentary: string | null;
  startedAt: string;
  settledAt: string | null;
}
```

Indexes:
- `by_sessionId` (for fetching a session's rounds in order)
- `by_startedAt` (for "recently generated" queries)

**Image storage choice.** Store image bytes as `ArrayBuffer` (preferred over base64 — half the size, native IndexedDB type). MIME type tracked alongside since OpenAI returns PNG/WebP and Gemini returns JPEG/WebP. Display via `URL.createObjectURL(blob)` from a Blob constructed at render time. See §10.4 for object-URL lifecycle and the `ImageCache` helper that owns revocation.

**Thumbnail generation.** On round settle, for each successful result, generate a 320×320 max-edge JPEG thumbnail using an `OffscreenCanvas` (`HTMLCanvasElement` fallback for browsers without it). Persist alongside the full bytes. `<HistoryRail/>` and `<RoundCard/>` mini-thumbnails render from `thumbnail`, never from `bytes` — keeps memory pressure linear in *visible* rounds, not total rounds.

**Storage growth math.** 16 images × ~1 MB avg × 10 rounds per session × 100 sessions ≈ 16 GB worst case for full bytes. Thumbnails add ~5% (16 × 30 KB × 10 × 100 ≈ 480 MB). Most sessions will be much smaller. DD-021 says no auto-GC; manual Clear History only.

### 5.3.1 TypeScript ergonomics — known friction points

The persisted shapes above are correct for storage but cost a small amount of friction at call sites. Implementers should expect (and not "improve away") the following:

- **`Partial<Record<Provider, ProviderConfig>>`** narrows to `ProviderConfig | undefined` on access. Every read site (`storage.providers.openai?.apiKey`) needs a guard. Helper: `getActiveProviders(storage): { openai?: ProviderConfig; gemini?: ProviderConfig }` doesn't reduce checks, but `getEnabledProviderEntries(storage): Array<[Provider, ProviderConfig]>` for iteration *does* — write that helper in `lib/storage/keys.ts` and use it everywhere.
- **`selections: { provider: Provider; index: number }[]` + parallel `openaiResults` / `geminiResults` arrays** means every selection-driven render or read has to dispatch on `provider` to pick the array. Helper: `getResult(round, sel): RoundResult | undefined` in `lib/round/selection.ts` returns `provider === "openai" ? round.openaiResults[index] : round.geminiResults[index]`. Use everywhere; do not inline.
- **Discriminated `RoundResult` (`status: "success" | "error"`)** is fine for pattern matching; keep it. TS narrows correctly through `if (r.status === "success")` and `switch (r.status)`. Resist the temptation to flatten into optional fields.
- **`imageCount: 4 | 8 | 16` literal type** vs. inputs that yield `number` — use a `parseImageCount(n: number): 4 | 8 | 16 | null` guard at the form-edge in `useRoundForm`. Don't `as`-cast at consumer sites.
- **`AspectRatioConfig` discriminated union** + the §5.1 invariant means `startRound*` and `setStorage` both need the snap helper. Centralize as `snapAspectIfNeeded(aspect, providers): AspectRatioConfig` in `lib/round/aspect.ts`; consume from all three enforcement points (§10.7).

### 5.4 In-memory shapes (not persisted)

- **Round state during execution** — the live `Round` object is held in component state until settle, then committed to IndexedDB.
- **Selection state** — `Set<number>` of slot indices, transient until "Evolve" advances the round.
- **Theme state** — read once at mount, exposed via context, written to storage on toggle.

---

## 6. Provider integration (deep dive)

### 6.1 OpenAI client — `src/lib/providers/openai.ts`

```ts
const OPENAI_BASE = "https://api.openai.com/v1";
const OPENAI_IMAGE_MODEL = "gpt-image-1"; // CONFIRMED §14.A — gpt-image-2 API access pending; use gpt-image-1 for MVP
```

Functions:

```ts
// Used by wizard validation (DD-022)
export async function testGenerate(apiKey: string): Promise<
  | { ok: true; tier: Tier; ipm: number }
  | { ok: false; error: NormalizedError }
>;

// Used by round engine (FR-2/3)
export async function generate(
  apiKey: string,
  args: {
    prompt: string;
    size: { width: number; height: number };
    referenceImages?: ArrayBuffer[]; // for round 2+
    signal?: AbortSignal;
  }
): Promise<
  | { ok: true; image: ArrayBuffer; mimeType: string; meta: ImageMeta }
  | { ok: false; error: NormalizedError }
>;
```

**Endpoint mapping**

- `testGenerate`: `POST /images/generations` with smallest-cost params (no reference images).
- `generate` (round 1, no references): `POST /images/generations`.
- `generate` (round 2+, with references): **likely `POST /images/edits`**, not `/images/generations`. Older OpenAI image models (DALL·E) split generation from editing into separate endpoints; `gpt-image-1` unified them under `/images/generations` with an optional `image` field. Whether `gpt-image-2` follows the unified pattern or reverts to `/images/edits` for references is **unconfirmed** and resolved by the §14.A smoke test. Provider client must pick the right endpoint based on whether `referenceImages` is present.
- Response format: gpt-image-1 defaults to `b64_json`; gpt-image-2's default is unverified. The wizard plan §7.1 hard-codes `response_format: "b64_json"`; if that field has been removed or renamed in gpt-image-2, the smoke test surfaces it before Phase 3.
- Verify request shape against current OpenAI image-generation docs at integration time. Open question §14.A.

**Header parsing for tier detection** — same logic as wizard (`src/lib/providers/tiers.ts`). Round engine also reads headers on every successful generate response and updates the in-storage `ipm` if the detected value disagrees with what's stored (gentle drift catches tier upgrades).

**Header names are unverified.** The wizard plan §7.1 reads `x-ratelimit-limit-images`. OpenAI's documented headers are `x-ratelimit-limit-requests` and `x-ratelimit-limit-tokens`; an `-images` variant is plausible for image endpoints but not documented at plan-write time. Phase 2 smoke test (§11) records the exact header set and updates `tiers.ts`. Fallback if no `-images` header exists: read `-requests` and treat the per-minute request cap as the IPM proxy.

**IPM-to-Tier mapping is provisional.** `{5, 20, 50, 100, 250}` for tiers 1–5 was sourced from OpenAI's gpt-image-1 documentation circa Q4 2025. gpt-image-2's tier numbers may differ. Smoke test confirms; if numbers shift, update `tiers.ts` only — the rest of the architecture is decoupled from specific values.

**Reference image encoding.** gpt-image-2 accepts reference images as multipart form data or as base64. Lean: multipart for size efficiency. Round 2+ flow assembles a FormData with the prompt, size params, and N image parts. Multi-reference (`image[]`) support is unconfirmed for gpt-image-2 — if the API caps at one reference image, plan B is to composite the K selected images into a single grid before sending (degrades quality, but unblocks the flow). Resolved by smoke test.

### 6.2 Gemini client — `src/lib/providers/gemini.ts`

```ts
const GEMINI_BASE = "https://generativelanguage.googleapis.com"; // v1 for listModels, v1beta for generateContent (image gen requires v1beta)
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"; // CONFIRMED §14.B — production model, Gemini-native image gen
```

Functions:

```ts
// Used by wizard validation (DD-022)
export async function listModels(apiKey: string): Promise<
  | { ok: true }
  | { ok: false; error: NormalizedError }
>;

// Used by round engine
export async function generate(
  apiKey: string,
  args: {
    prompt: string;
    aspect: GeminiSupportedRatio; // discrete only — Gemini doesn't accept arbitrary
    referenceImages?: ArrayBuffer[];
    signal?: AbortSignal;
  }
): Promise<
  | { ok: true; image: ArrayBuffer; mimeType: string; meta: ImageMeta }
  | { ok: false; error: NormalizedError }
>;
```

**Endpoint shape** — Gemini's image gen uses `models/{model}:generateContent` with multipart text+image parts. Reference images go as inline `image/png` parts. Confirm shape at integration time (§14.B).

**Aspect handling** — Gemini takes one of its 10 supported ratios via API parameter (no arbitrary). When a freeform aspect is requested but Gemini is enabled, the round engine snaps to the nearest supported ratio per DD-023 *before* dispatching to the Gemini client.

### 6.3 Tier detection (`src/lib/providers/tiers.ts`)

```ts
const IPM_TO_TIER: Record<number, Tier> = {
  5: "tier1",
  20: "tier2",
  50: "tier3",
  100: "tier4",
  250: "tier5",
};

export function ipmToTier(ipm: number): Tier {
  return IPM_TO_TIER[ipm] ?? closestTier(ipm);
}

export function defaultIpm(tier: Tier): number {
  // Used as fallback when headers missing or for Gemini self-declared tiers
  switch (tier) {
    case "free":  return 0;
    case "tier1": return 5;  // pessimistic
    case "tier2": return 20;
    case "tier3": return 50;
    case "tier4": return 100;
    case "tier5": return 250;
  }
}

function closestTier(ipm: number): Tier { /* nearest known IPM */ }
```

For Gemini: `defaultIpm(declaredTier)` since headers don't expose it reliably.

### 6.4 Concurrency throttle — `src/lib/round/throttle.ts`

Per-provider FIFO queue. Each call has an `enqueue(fn)` API; the queue runs up to `concurrencyCap` calls concurrently and drains the rest in order.

```ts
export class ProviderThrottle {
  constructor(private cap: number) {}
  setCap(cap: number) { this.cap = cap; }   // live-tunable from settings
  enqueue<T>(fn: () => Promise<T>): Promise<T> { /* ... */ }
  inflight(): number;
  queued(): number;
}
```

`Round.orchestrate` creates one `ProviderThrottle` per active provider, sized to `ProviderConfig.concurrencyCap`. UI subscribes to `inflight()` + `queued()` for the "waiting…" tile state.

### 6.5 Retry policy — `src/lib/round/retry.ts`

```ts
type Retryable = "rate_limited" | "server_error" | "network_error";

const RETRYABLE_KINDS: Set<ErrorKind> = new Set(["rate_limited", "server_error", "network_error"]);

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: { signal: AbortSignal; maxAttempts?: 3; }
): Promise<T> {
  let attempt = 0;
  let delay = 1000; // ms; doubled with jitter on each attempt
  while (true) {
    attempt += 1;
    try {
      return await fn(opts.signal);
    } catch (err) {
      const norm = normalizeError(err);
      if (attempt >= (opts.maxAttempts ?? 3) || !RETRYABLE_KINDS.has(norm.kind)) throw err;
      // Cap Retry-After at MAX_RETRY_AFTER_MS to prevent absurd provider responses
      // (e.g. 3600s) from holding a throttle slot for an hour. If the server asks
      // for longer than this, we treat the slot as fatally rate-limited: surface
      // a 429 error to the UI; user can manually click Regenerate when ready.
      const MAX_RETRY_AFTER_MS = 60_000;
      const requested = norm.retryAfterSeconds != null
        ? norm.retryAfterSeconds * 1000
        : delay + Math.random() * 250;
      if (norm.retryAfterSeconds != null && requested > MAX_RETRY_AFTER_MS) {
        throw err; // bail out; do not hold the slot
      }
      const wait = Math.min(requested, MAX_RETRY_AFTER_MS);
      await sleep(wait);
      delay *= 2;
    }
  }
}
```

**Throttle interaction (chosen pattern, with rationale).**

The orchestrator wraps each provider call in `throttle.enqueue(() => withRetry(fn))`. Retries happen *inside* the throttled function — the throttle slot is held for the entire retry chain. This means a slot can be tied up during a 30s `Retry-After` wait, which is wasteful in latency terms but consistent with DD-019: "Retries respect the per-provider concurrency throttle (DD-016) — re-queued into the local queue, not bypassed."

Why we chose hold-the-slot over release-and-re-enqueue:
- **Simplicity** — no extra cross-component API surface (no `throttle.pauseFor()`, no re-entry coordination).
- **Bounded waste** — at worst, a slot is idle for `Retry-After` seconds. With 3-retry budget and exponential backoff, total worst case ≈ 30s + 4s + 8s ≈ ~45s of slot hold. For a Tier 1 user with 5 slots, that's a meaningful fraction of round latency, but the user is already capacity-constrained — releasing a slot wouldn't help them generate more in parallel.
- **No starvation risk** — re-enqueueing on retry could cause a high-failure-rate provider to monopolize queue cycles, starving fresh requests behind it.

Marked as a v2 optimization candidate in §14.R if real-world latency profiling shows hold-the-slot is the dominant contributor to round latency at higher tiers.

### 6.6 Failure normalization — `src/lib/providers/errors.ts`

```ts
type ErrorKind =
  | "auth_failed"        // 401, 403
  | "rate_limited"       // 429
  | "bad_request"        // 400
  | "content_blocked"    // 422 / safety filter
  | "server_error"       // 5xx
  | "network_error"      // fetch failed / aborted
  | "quota_exhausted"    // user's API quota empty
  | "unknown";

interface NormalizedError {
  kind: ErrorKind;
  message: string;          // user-facing
  httpStatus?: number;
  retryAfterSeconds?: number;
  raw?: unknown;            // for debugging only — never displayed
}
```

Each provider has its own `mapError(response, body)` that produces a `NormalizedError`. Round engine and wizard both consume the normalized type.

**Network failure granularity.** `network_error` is a single bucket but carries enough info in `message` to distinguish three sub-cases the UI surfaces differently:
- DNS / connection refused (captive portal, provider domain blocked) → *"Couldn't reach OpenAI. If only one provider is failing, your network may be blocking it."*
- Aborted by user/page-unload (`AbortError`) → *"Cancelled."* (treated as terminal, no retry).
- Timeout / partial-response truncation → *"Connection dropped. Retrying."* (retryable).

`mapError` inspects `err.name` (`AbortError` vs `TypeError`) and the response state to populate `message` distinctly. `errorToMessage(err, "round")` returns the right copy for each. The `kind` stays `network_error` for the retry policy — only the user-facing copy differs.

**Centralized user-facing message mapping.** A single function `errorToMessage(err: NormalizedError, context: "wizard" | "round"): string` lives in `src/lib/round/failures.ts` and is the single source of truth for mapping a `NormalizedError` to user-facing copy. Both `<ImageCardError/>` and `<RateLimitBanner/>` consume it via a `useErrorToast()` hook (also in `failures.ts`) that wraps the project's toast primitive. Wizard error tiles use the same function with `context: "wizard"` for slightly different phrasing (e.g. "Re-check and try again" vs "Try regenerating"). Avoids duplicated copy across surfaces.

---

## 7. State management strategy

### 7.1 Per-slice ownership

| Slice | Owner | Storage |
|---|---|---|
| Wizard step + draft keys | `<WizardShell/>` `useReducer` | `localStorage["vucible:v1.wizard"]` |
| Persistent keys / defaults | Top-level `<KeysProvider/>` context | `localStorage["vucible:v1"]` |
| Active round | `<RoundProvider/>` | in-memory until settle, then IndexedDB |
| History list | Lazily-loaded from IndexedDB into a `<HistoryProvider/>` | IndexedDB |
| Theme | `<ThemeProvider/>` (uses `next-themes`-style approach) | `localStorage["vucible:v1"].defaults.theme` |
| Settings dialog open/closed | local `useState` in `<TopBar/>` | none |

### 7.2 Why React Context (not Zustand/Jotai/Redux)

- We don't have remote-cached entities (no React Query story).
- We don't have cross-deeply-nested updates (no atom story).
- Each provider is read by a small subtree.
- Adding a state lib costs onboarding + bundle for no clear gain at MVP.

If updates start tunneling through > 4 levels of `prop`, reach for Zustand. Don't pre-emptively.

### 7.3 Avoiding hydration mismatches

`<WizardOrApp/>` reads localStorage in `useEffect`, not during render. Initial render returns a `<LoadingSkeleton/>` that matches between SSR and client. Once mounted, swaps to wizard or app.

For theme: use the `next-themes` pattern — script in `<head>` reads localStorage and sets a class on `<html>` before React hydrates, preventing flash-of-wrong-theme.

---

## 8. UI / visual design

(Recap of recent decisions, no new DDs needed here — these are implementation choices that follow from prior locks.)

- **Theme**: dark default with system-matching toggle. Light mode supported but not the primary canvas. Generated images pop on dark.
- **Theme tokens**: shadcn zinc base. No custom palette in v1.
- **Typography**: Geist Sans + Geist Mono (Next 16 scaffold defaults).
- **Density**: comfortable, not compact. 16-image grids need breathing room.
- **Card aspect**: matches the round's chosen aspect ratio (DD-023). Clean N×M grid since per-round-uniform.
- **Motion**: subtle. Skeleton placeholders for loading slots. Cards fade in as they arrive (`opacity-0 animate-in fade-in duration-300` from `tw-animate-css` — already installed). Honor `prefers-reduced-motion`.
- **Iconography**: lucide-react.

Layout (desktop primary; responsive but mobile is best-effort):

```
┌─────────────────────────────────────────────────────────┐
│ [logo] vucible             [history] [theme] [settings] │  ← TopBar
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Original prompt: "..."                              │ │  ← shown for round 2+
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [textarea: prompt]                                  │ │
│  │ [☐ OpenAI] [☐ Gemini]   [aspect picker]   [4|8|16] │ │
│  │                              [Generate →]          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ── OpenAI ─────────────────────────────────────────    │
│  [card] [card] [card] [card]                            │
│  [card] [card] [card] [card]                            │
│  ── Gemini ─────────────────────────────────────────    │
│  [card] [card] [card] [card]                            │
│  [card] [card] [card] [card]                            │
│                                                         │
│  Selected: 0/4                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Optional commentary for next round...            │   │
│  └──────────────────────────────────────────────────┘   │
│                    [Evolve →]                           │
└─────────────────────────────────────────────────────────┘
```

History rail slides in from the left when toggled.

---

## 9. Cross-cutting concerns

### 9.1 Accessibility

- Keyboard navigation: every interactive control reachable via Tab; focus rings visible.
- Aspect picker buttons: arrow-key navigation within the discrete grid.
- Image cards: focusable; Space/Enter to select; Shift+click to multi-select; Esc to clear selection.
- Error tiles: `role="status"` with `aria-live="polite"`.
- Toasts: sonner pattern with `aria-live="assertive"` for errors.
- Color contrast: all text ≥ 4.5:1 against background.
- Reduced motion honored throughout.

### 9.2 Performance

- **First paint**: server-render the `<TopBar/>` and a skeleton; defer `<WizardOrApp/>` to client. Target: LCP < 1.5s on a fast connection.
- **Image rendering**: never decode reference images on the main thread for round 2+; offload to a Web Worker if profiling shows jank.
- **IndexedDB writes**: batch a round's writes into a single transaction.
- **Streaming**: don't `await Promise.all` the round; spawn N independent promises and update grid state as each settles.
- **Bundle**: with `output: 'export'` (DD-020) there are no on-demand server-rendered routes, but `next/dynamic` with `{ ssr: false }` still produces a separate JS chunk that's only fetched when the gate decides to render the wizard. `<WizardOrApp/>` chooses between `dynamic(() => import('@/components/wizard/WizardShell'))` and `dynamic(() => import('@/components/shell/AppShell'))` so first-time users don't pay the AppShell bundle cost and returning users don't pay the wizard bundle cost. Verified by inspecting the export's `_next/static/chunks/` after build.

### 9.3 Error boundaries

- Top-level `<RootErrorBoundary/>` in `app/layout.tsx`.
- Per-slice boundaries: `<WizardErrorBoundary/>`, `<RoundErrorBoundary/>`, `<HistoryErrorBoundary/>`. Each shows a minimal "something broke, here's the error, try refreshing" UI without losing the rest of the app.
- All caught errors logged to `console.error` (no remote logging — DD-001 forbids backend).

### 9.4 Logging

Plain `console.debug` / `console.warn` / `console.error`. No telemetry library. Per AGENTS.md "Console Output" section: structured, minimal — avoid spam in successful paths.

### 9.4.1 BFCache restoration

Safari and Firefox aggressively place navigated-away pages into the back/forward cache (BFCache); the page resumes with full JS state preserved on `popstate`/`pageshow`. This interacts badly with our `beforeunload`-driven `AbortController.abort()` (§10.4): when the page entered BFCache, we aborted in-flight rounds and revoked object URLs, but the JS state still references the now-dead controllers. On `pageshow` with `event.persisted === true`:

1. Treat the active round (if any) as terminated — same path as the orphan-round sweep (§10.4).
2. Re-create `ImageCache` and `ThumbnailCache` from scratch; the prior object URLs are revoked.
3. Force a re-render so `<img>` tags reach for fresh URLs from the cache.

Listener lives in `<AppShell/>` and is the only `pageshow` listener in the app.

Conversely: do NOT call `abort()` on `pagehide` if `event.persisted === true` — the page is going into BFCache, not unloading; aborting would needlessly throw away in-flight work that *might* resume cleanly. Lean: still abort, accept the cost. Restoration always re-renders as terminated rather than trying to reconcile half-aborted state. Cleaner state machine.

### 9.5 Browser support

Modern evergreen: Chrome ≥ 110, Firefox ≥ 110, Safari ≥ 16, Edge ≥ 110. We use IndexedDB v3, fetch, AbortController, BigInt, structuredClone — all baseline in those versions.

**Private / incognito modes.** Safari Private Browsing severely caps both `localStorage` (~7 days, per-tab partitioned in some configurations) and IndexedDB; Firefox Private Browsing wipes IndexedDB on close. The app must (a) detect private mode where feasible (Safari: `localStorage.setItem` may throw `QuotaExceededError` on first write attempt; Firefox: IndexedDB `open()` may reject with `InvalidStateError`) and (b) surface a non-blocking banner: *"You're browsing privately. Your keys and history won't persist between sessions."* This is documentation-of-reality, not a fix — we don't have a workaround. See §14.S for the open question on whether to soft-block first-run wizard in private mode.

### 9.5.1 Multi-tab behavior

Two tabs of vucible open at the same origin share `localStorage`, IndexedDB, and the **browser-level rate-limit budget at the provider** — but each tab runs an *independent* `ProviderThrottle` instance that thinks it has the full IPM cap to itself. Concrete failure modes:

- **Settings clobber.** Tab A and Tab B both auto-save on blur (§10.3) → last-write-wins; the slower tab silently overwrites the faster tab's change.
- **Spurious 429s.** Both tabs running rounds simultaneously → combined inflight exceeds provider IPM → 429s that the per-tab throttle didn't anticipate. Retry budget burns. User sees error tiles for what looks like a bug.
- **Eager-intent placeholder collision.** Two tabs starting a round in the same session at the same moment → two `Round` records with overlapping `number` field. Schema has no unique constraint per (sessionId, number).

Mitigation (v1, minimum viable):

1. **Cross-tab broadcast on storage writes.** `<KeysProvider/>` listens to the `storage` event (fires when *another* tab writes to localStorage) and re-reads `vucible:v1` to keep state fresh. Last-write-wins persists, but at least the active UI in each tab reflects current truth.
2. **Single-writer hint at round start.** On `startRound*`, check via `BroadcastChannel("vucible")` whether another tab claims an active round in the same session. If yes, show an inline warning: *"Another vucible tab is generating right now. Running rounds in parallel will burn your rate limit faster — consider closing the other tab."* Non-blocking — user can override.
3. **Acknowledge the gap.** True multi-tab safety (cross-tab throttle coordination via `SharedWorker` or `BroadcastChannel`-mediated lease) is **out of scope for v1**. Documented in §14.W.

### 9.6 Browser-origin (CORS) viability for provider APIs — load-bearing bet

DD-001 asserts "Both target APIs support browser-origin calls with the user's own key." This is **the single largest unverified bet in the plan** — if either API blocks browser-origin calls, the entire BYOK architecture collapses and we'd need a thin proxy (which contradicts DD-001).

Known facts as of plan-write time:
- **OpenAI**'s official SDK requires `dangerouslyAllowBrowser: true` to run in a browser, and `api.openai.com` historically did not send permissive CORS headers for arbitrary origins. Direct `fetch()` from a browser to `https://api.openai.com/v1/images/generations` may fail at the preflight (`Access-Control-Allow-Origin`) check on some endpoints.
- **Gemini**'s `generativelanguage.googleapis.com` REST endpoint accepts `?key=<apiKey>` query-param auth and historically *does* send permissive CORS headers — but the multipart `:generateContent` shape with inline images is less battle-tested in the browser.

Mitigation plan (executed in **Phase 0, before any other work**):

1. **CORS smoke test.** A standalone script (`scripts/cors-smoke.html` — open in a browser; not a Next.js page yet) that, with a real key, attempts:
   - `POST` to `/v1/images/generations` (OpenAI) — minimal body, observe network tab.
   - `GET /v1/models?key=...` (Gemini) — observe.
   - `POST` `models/{id}:generateContent` (Gemini) — observe.
   For each, check: does the preflight `OPTIONS` succeed? Does the actual request return the response body or a CORS-blocked opaque?
2. **Decision gate.** If OpenAI blocks browser-origin calls, the project pivots before Phase 1 starts:
   - Option A — accept a thin Vercel Edge Function proxy *for OpenAI only* (3–5 lines: forward the request, including the user's key, do not log). This is a partial backslide on DD-001 and would require a new DD-024.
   - Option B — drop OpenAI in v1; ship Gemini-only.
   - Option C — pivot the whole project to a desktop wrapper (Tauri/Electron), out of v1 scope.
3. **Recorded outcome** in §14.T (added below).

Why this isn't paranoia: every prior browser-only OpenAI app the author has seen either uses a proxy or runs in an Electron wrapper. The "no backend, just call from the browser" pattern is the path of least resistance on paper and a known footgun in practice.

Test-gen call cost note: the CORS smoke test for OpenAI will spend ~$0.04 of the author's API budget. Budgeted; cheaper than building the wizard then discovering CORS blocks the test-gen call.

---

## 10. Feature implementation details

### 10.1 FR-1 — API key management

Realized through:
- Storage layer (`src/lib/storage/keys.ts`)
- Wizard (`src/components/wizard/*`) — initial entry
- Settings (`src/components/settings/KeysPanel.tsx`) — re-entry / re-test / clear

Files: `src/lib/storage/{keys,schema}.ts`, `src/lib/providers/types.ts`.

Acceptance:
- Keys never leave the browser.
- Clearing all keys resets to wizard state.

### 10.2 FR-8 — Setup wizard

**Plan: see `docs/plans/wizard.md`** for full detail (component tree, state machine, copy, error states, implementation order, test plan). Summary here:

- Required first-run, no escape hatch.
- Steps: Welcome → Add keys → Defaults → Confirm.
- Per-provider validation: OpenAI does test-gen for tier auto-detect; Gemini does list-models with user-declared tier.
- Persists to `localStorage["vucible:v1"]` on completion.

### 10.3 FR-9 — Settings page

`<SettingsDialog/>` opens from gear icon. Side-sheet variant of shadcn Dialog. **Auto-saves on field blur** with optimistic UI — no Save button, no sticky footer, no dirty-state tracking. Each panel writes directly to `localStorage["vucible:v1"]` on blur. If a write fails (e.g. quota), revert the field with a toast.

Rationale: every field is a single value with a clean validation rule. Sticky-footer + Save would be ceremony for nothing on a panel this small. Concurrency-cap changes are already "live" per DD-018 — auto-save aligns.

Sections:

#### Keys panel
- Per-provider: paste field, current tier badge, re-test button (= same mechanic as wizard validation), clear button.
- "Clear all keys" at bottom → confirm dialog → wipe storage → reload → wizard.

#### Defaults panel
- Default image count (mirrors wizard, but live; auto-saves on click).
- Default aspect ratio (mirrors wizard, picker form follows enabled providers per DD-023; auto-saves on selection).
- Theme: System / Dark / Light (auto-saves on toggle).

#### Concurrency panel
- Per-provider numeric input, hard-capped at detected/declared `ipm`. Auto-saves on blur.
- Block-with-explainer if user types above cap (per DD-016): inline note + upgrade link.
- "Reset to detected default" link.

#### History panel
- Storage usage estimate (`navigator.storage.estimate()`). Not available on Safari < 16 or in some private modes — when missing or rejecting, fall back to *"Storage usage unavailable in this browser. {N} rounds across {M} sessions."* counted from IndexedDB. Never block the panel on the estimate; render the count first, then patch in the byte estimate when (if) the promise resolves.
- "Clear history" button → confirm dialog → wipe IndexedDB (DD-021).

Component reuse: `<ProviderCard/>`, `<TierBadge/>`, `<ImageCountPicker/>`, `<AspectRatioPicker/>` — all written in the wizard slice and reused here.

Acceptance:
- All wizard-set defaults can be edited; auto-saved on blur with no explicit Save button.
- Concurrency cap enforcement is hard.
- Clear history works and Storage Manager API confirms reduced usage.

### 10.4 FR-2 — Round 1 generation

Realized in `<RoundProvider/>` + `src/lib/round/orchestrate.ts`.

Flow (`startRoundOne(prompt, modelsEnabled, count, aspect)`):

1. Validate inputs (non-empty prompt, ≥1 model enabled, count ∈ {4,8,16}).
2. Enforce aspect invariant (§5.1): if `modelsEnabled.gemini && aspect.kind === "freeform"`, snap to nearest supported ratio before proceeding.
3. Compute per-provider call slate:
   - Both enabled → `count/2` per provider (`openaiResults` and `geminiResults` arrays sized accordingly per §5.3).
   - Single enabled → `count` to that provider; the other array is empty.
4. Per-provider aspect resolution:
   - OpenAI: pass `aspect` through (any size).
   - Gemini: discrete only (already enforced in step 2).
5. Create new `Round` object in memory with `openaiResults` and `geminiResults` initialized to slot-count `{status:"loading"}` arrays. Generate the round ID via `generateId()` (ULID).
6. **Eager intent persistence:** write a placeholder `Round` record to IndexedDB immediately — full schema, all slots in `loading` state, `settledAt: null`. Single transaction. Makes refresh-during-round feel instant (history rail shows the in-progress round) and gives us a recovery anchor.
7. For each slot in each provider's array, run `throttle[provider].enqueue(() => withRetry(() => provider.generate(...)))`. Update in-memory state on each settle so the UI streams. **Do not write to IndexedDB per-card** — batch at settle.
8. **Live progress signal:** `<RoundProvider/>` exposes a derived `{ done: number; total: number; queued: number }` from the throttle's `inflight()` + `queued()` + the in-memory result counts. `<ResultGrid/>` shows a global banner *"8 of 16 complete · 3 waiting"* while the round is in-progress.
9. Once all slots terminal: generate thumbnails (§5.3) for successes, set `round.settledAt = now()`, **single IndexedDB transaction** to overwrite the placeholder with the final round.

Why batched persistence: per-card writes are ~16 IndexedDB transactions per round. A single settle write is one transaction with all the bytes. IndexedDB transaction setup is the slow path; payload size matters less. For mid-round refresh recovery the eager intent placeholder (step 6) is sufficient — a refreshed round is treated as terminated (no in-flight calls re-attempted; failed slots get error tiles with Regenerate per DD-019). Resolves §14.M.

**Startup orphan-round sweep.** On `<AppShell/>` mount, `loadHistory()` queries IndexedDB for any `Round` with `settledAt === null`. Each such round is rewritten in a single transaction: every slot still in `loading` state becomes `error` with `kind: "network_error"` and `message: "Round interrupted (refresh or tab close)."`; `settledAt` is set to `now()`. Without this sweep, orphan rounds linger forever with `loading` slots that the UI would render as in-progress shimmers in the history rail. Sweep runs once per mount, idempotent. If a sweep fails (IDB error), the app proceeds anyway — the orphans render as terminal-with-error via per-slot fallback in `<RoundCard/>` (treat unknown-status slots as `error`).

**New Session button.** Once the current session has at least one settled round, a "New Session" button appears in `<PromptArea/>` (next to "Generate"). Clicking it: confirm-if-unsettled → starts a fresh `Session` record on next Generate. Replaces the ambiguous "type a new prompt → ???" flow. Resolves §14.N.

**Image cache and object URLs.** `src/lib/round/image-cache.ts` exports a singleton `ImageCache` that owns `URL.createObjectURL` lifecycle. Components request `cache.get(roundId, slotKey)` to get a stable object URL for an image; the cache lazily creates Blob+URL from the round's `bytes` on first access and `revokeObjectURL`s when the consumer unmounts (refcounted) or when the cache is evicted via LRU (max ~64 active URLs). Prevents the leak when users scroll the history rail extensively. Thumbnails (§5.3) get the same cache treatment via a sibling `ThumbnailCache`.

**Eviction-vs-render safety.** Refcounting on `cache.get()`/`cache.release()` (called via `useEffect` mount/unmount) is the primary eviction guard: an entry with `refcount > 0` is **never** evicted, even if it's the LRU candidate. Eviction only considers entries with `refcount === 0`. The cap (96 / 256) is therefore a soft floor — under pathological load (e.g. user scrolls extremely fast across history with many `<img>` elements alive) the cache can exceed the cap. That's preferable to revoking a URL that an `<img>` is mid-decoding, which produces a permanently-broken render even after re-mount (Chrome and Safari treat revoked URLs as a dead reference for that decode lifecycle). If the cache balloons past 2× the cap, log a `console.warn` and continue; this is a profiler signal, not a correctness issue.

**MIME preservation on read-back.** `Round.openaiResults[i].mimeType` and `geminiResults[i].mimeType` (§5.3) are persisted alongside `bytes`. `ImageCache` constructs the Blob as `new Blob([bytes], { type: mimeType })` — never default `application/octet-stream`. Likewise `prepareReferences` (§10.5) reads `mimeType` from each selected `RoundResult` and uses it on both the multipart Blob (OpenAI) and the inline part header (Gemini). A missing/empty mimeType is a corruption signal — the slot is treated as errored and excluded from the reference set with a console warn. Prevents 400s from OpenAI on multipart uploads with wrong content-type.

**Cap sizing math.** 64 active full-bytes URLs × 1 MB ≈ 64 MB resident — fits modern devices comfortably. With current-round (16) + previous-round (16) + history rail expansion (up to ~3 hovered rounds × 16) we're at ~80 active URLs in the worst case, so `ImageCache` caps at **96** for full bytes (not 64). `ThumbnailCache` runs separately at **256** (each thumbnail ~30 KB → ~8 MB resident worst case). Numbers re-tunable; updated from a single constant.

**Double-click guard on Generate / Evolve.** Both buttons are disabled the moment a round starts (`<RoundProvider/>` exposes `isRunning` derived state). The button component itself uses `disabled` state plus a guard inside `onClick` to early-return if `isRunning` is true — defense-in-depth in case of race between state propagation and click event. Prevents double-fan-out (32 calls instead of 16) which would (a) double-charge the user, (b) break the throttle slot accounting, (c) cause both rounds' results to interleave into the same grid.

**AbortController lifecycle.**
- Each round owns one `AbortController`. The signal is passed into every `withRetry → provider.generate(...)` call.
- The controller is aborted when: (a) user clicks "New Session" mid-round (after confirm), (b) user navigates away (`beforeunload` listener calls `abort("page-unload")`), (c) the component unmounts. Aborted-then-resumed flows are not supported in v1: an abort settles the round as terminal, in-flight slots become `error` with kind `network_error` (signaling user-canceled).
- We do NOT abort on a single failed slot or to "clean up after settle" — the round controller is one-shot and dies with the round.
- `ResultGrid`'s "Regenerate" per-slot creates a fresh controller scoped to that single slot (or piggy-backs on the round's if the round is still active). Resolves the lifecycle ambiguity from prior drafts.

**Test-gen accounting against IPM.** When the wizard completes, the OpenAI test-gen call has consumed 1 of the user's IPM budget within the rolling minute window. The first round of the main app is fired immediately after wizard completion in many flows. The throttle's IPM accounting is *cold-started* with no knowledge of the test-gen call — so a Tier 1 user could see a spurious 429 on the first card of round 1.

Mitigation: when `validate-success` fires in the wizard reducer, persist a `lastValidatedAt: ISO-8601` *and* mark the in-memory throttle as having one slot consumed for the next 60 seconds after completion. The throttle exposes `seedConsumed(count: number, ttlMs: number)` so the wizard's hand-off can prime it. If the user takes more than 60 s to type their first prompt, the seed expires naturally. Tested by manual Phase 6 smoke.

Acceptance:
- 16 calls fan out, throttled per `concurrencyCap`.
- Cards stream in (no batched render).
- Live progress banner updates as cards arrive.
- Refresh during round → IndexedDB has placeholder; UI shows that round as terminated; user can regenerate failed slots via DD-019 mechanism.
- "New Session" button visible once ≥1 round settled in the current session.

### 10.5 FR-3 — Round 2+ evolution

**Prompt length enforcement.** DD-015 acknowledges per-round prompt growth toward provider caps (~4000 chars OpenAI; Gemini's is similar order of magnitude). `buildEvolvePrompt(session, currentRoundN)` MUST measure the produced prompt length and apply a fallback if it exceeds a configured `MAX_PROMPT_CHARS = 3500` (conservative buffer below documented caps):

- **Strategy on overflow:** keep original prompt + last 3 rounds' commentary verbatim; collapse older rounds into a single line: `"After rounds 1–{N-4}: (commentary trail summarized: {first-50-chars-of-each, joined with ' · '})"`. Crude but deterministic; keeps the trail audit-visible without hitting the cap.
- This is the v0 mitigation flagged in DD-015 — implemented up front rather than waiting for an observed 400. A 400 from a too-long prompt at round 9 would charge the user nothing (request rejected pre-billing) but ruins the round; cheap to prevent.
- Unit-tested with synthetic 20-round histories.

`startRoundN(session, selectedRoundId, selections, commentary)`:

1. **Prepare references once, share across all parallel calls.** `prepareReferences(round, selections)` (in `src/lib/round/prepare-references.ts`):
   - Load `bytes` for each selected `{provider, index}` pair from IndexedDB once.
   - For each reference image, build both shape variants up-front:
     - `Blob` (for OpenAI multipart FormData parts)
     - base64 string (for Gemini inline parts)
   - Return a `PreparedReferences = { blobs: Blob[]; base64Parts: string[] }` object held in memory for the duration of the round.
   - All N parallel calls *share the same* `PreparedReferences` — encoding work happens once, not N times. Significant CPU savings on 16-call rounds with 4 references each.
2. Build prompt via `buildEvolvePrompt(session, currentRoundN)` → DD-015 round-2 or round-N template (`src/lib/round/prompt.ts`).
3. Same fan-out as round 1, including the eager intent persistence (§10.4 step 6) and the batched settle write.
4. Each `generate()` call receives the `PreparedReferences` plus the prompt. Provider clients pick the right variant (OpenAI uses `blobs`, Gemini uses `base64Parts`).
5. Same throttling, retries, streaming, settle logic.

Memory note: at most ~5 MB of reference Blobs live in memory during round dispatch (4 references × ~1 MB each + base64 ≈ 1.33× overhead). Released when the round settles and `PreparedReferences` goes out of scope.

Acceptance:
- Round 2+ prompt matches the DD-015 template exactly when inspected via DevTools network tab.
- Reference images survive multiple rounds (commentary trail accumulates correctly).
- Aspect ratio carries forward unless user overrides; aspect invariant (§5.1) still enforced.
- Memory profiler shows reference encoding happens once per round, not per call.

### 10.6 FR-4 — Model toggle

`<ModelToggle/>` is a controlled component owned by `<PromptArea/>`. **The full prompt-form state (model toggle + aspect picker + image-count picker + prompt textarea) lives in a `useRoundForm()` custom hook in `src/components/round/useRoundForm.ts`** — `useReducer` over a `RoundFormState` slice. Avoids prop-drilling these tightly coupled controls and avoids polluting `<RoundProvider/>` with form state that doesn't matter to anyone else.

When the user clicks "Generate", `<PromptArea/>` calls `roundProvider.startRound(formState.snapshot())` — passing a snapshot, not subscribing. `<RoundProvider/>` only sees the form values at the moment of dispatch.

Persistence across rounds within a session: kept in `<PromptArea/>` memory only. Resets when "New Session" is clicked. Resolves §14.J.

Toggling Gemini changes the aspect picker form (DD-023). Both controls live in `useRoundForm`, so the change is local and instant.

Edge: user disables both → Generate button disabled with tooltip *"Enable at least one provider."*

**Form lock-during-round.** The entire `useRoundForm` form (prompt textarea, model toggle, aspect picker, image-count picker) is **read-only** while `isRunning` is true. Snapshot at dispatch is the only authoritative form state for that round; if the user could mutate the form mid-round, the visible toggles would diverge from what's actually being generated, and the snap-on-Gemini-toggle UX (§10.7) would fire mid-round and surprise the user. Form unlocks on settle. The lock is implemented at the `useRoundForm` reducer level (rejects all action dispatches when `isRunning`), not just visual `disabled` — defends against keyboard shortcuts, paste events, etc.

### 10.7 FR-11 — Aspect ratio control

`<AspectRatioPicker/>` switches between two forms based on `geminiEnabled` from `useRoundForm`:
- True → `<DiscreteRatioGrid/>` (10 visual rectangle buttons).
- False → `<FreeformRatioInput/>` (W × H number inputs, with "Quick presets" expand to show the same 10 discrete buttons).

Snap-on-re-enable: when the user toggles Gemini back on while a freeform aspect is set, the reducer auto-snaps to nearest supported ratio and surfaces an inline `<SnapNotice/>`. User can override by toggling Gemini off again.

**Invariant enforcement.** The aspect invariant from §5.1 is enforced in three places, defense-in-depth:
1. `useRoundForm` reducer — auto-snaps on Gemini-toggle-on (UI level).
2. `startRound*` — re-validates and snaps if necessary before persistence (orchestrator level).
3. `setStorage()` — final guard at write time (storage level).

Triple coverage is intentional: the picker's auto-snap is the user-visible path; the orchestrator and storage guards catch any code path that builds round/storage state programmatically (e.g. settings auto-save with stale form state).

Aspect type is part of the round form state; persisted into the `Round` record on round start.

Acceptance:
- Toggling Gemini off then on with `5:2` set → snaps to `21:9` with notice.
- Sending `5:2` with Gemini off → OpenAI receives exact arbitrary size.
- Image cards in the grid take the chosen aspect.
- Storage never contains a freeform aspect with Gemini configured (verified via test).

### 10.8 FR-5 — Grid display + selection

`<ResultGrid/>` lays out two `<ModelSection/>`s vertically (DD-012). Each section header has the provider name + "N images, M selected".

`<ImageCard/>` states:
- `loading`: shimmer placeholder at the chosen aspect.
- `success`: image rendered via `<img src={objectUrlFromBlob}/>` + selection overlay on hover/focus.
- `error`: per-error-type message (DD-019 mapping) + Regenerate button.

Selection mechanic:
- Click toggles selection; max 4 enforced (5th click no-op + brief shake animation).
- Only `success` slots are selectable; `loading` and `error` slots ignore clicks.
- Selection persists into the round record on advance.
- Visible "Selected: 2/4" counter beneath the grid.

**Evolve enablement rules.**
- Evolve button **disabled** when: round not yet settled, OR `selections.length === 0`, OR all 16 slots are `error` (no successes to pick from). Tooltip explains: *"Pick 1–4 favorites to continue"* / *"All cards failed — regenerate or start a new prompt"*.
- Going from 1 selected → user un-selects the last one → Evolve disables in real time. No confirmation needed.
- Edge: round settles with N successes where N < 4 — selection cap is implicitly `min(4, N)`.

`<ImageZoom/>` modal opens on dedicated zoom button (not click — click is for selection); shows full size with prev/next nav.

Acceptance:
- Streaming behavior verified (cards arrive at different timestamps).
- Selection cap enforced.
- Zoom modal works.

### 10.9 FR-6 — History

`<HistoryRail/>` is a side panel toggled from `<TopBar/>`. Shows `<RoundCard/>` mini-thumbnails of past rounds in this session. Clicking scrolls main canvas to that round (or opens it in a read-only `<ScrollBackPanel/>`).

DD-010 says strictly linear — no jumping back to fork. So scroll-back is read-only; "Evolve" button is hidden when viewing a non-most-recent round.

Cross-session history: rail can also expand to show prior sessions ("Sessions →" link → list of past sessions with first prompt + start date). Clicking loads that session as read-only.

Acceptance:
- Refresh mid-session → history rail still shows everything.
- Multiple sessions accessible.
- Read-only rounds don't show Evolve.

### 10.10 FR-7 — Export

Right-click on any successful image card → browser-native "Save image as…" works because the image is rendered as `<img>` from a Blob URL.

Explicit download button on `<ImageCardSuccess/>` (small icon, hover-revealed) → triggers programmatic download with a sensible filename: `vucible-{sessionId}-r{N}-{slot}.png`.

No "export the journey" feature in MVP (per non-goals).

### 10.11 FR-10 — Failure handling

Realized in `src/lib/round/{retry,failures,orchestrate}.ts` + `src/lib/providers/errors.ts` + `<ImageCardError/>` + `<RateLimitBanner/>`.

Behavior already specified in §6.5 (retry policy) and §10.8 (error tile UI). Acceptance criteria mirror DD-019 and FR-10.

**Single error message source.** All `NormalizedError` → user-facing copy mapping lives in `src/lib/round/failures.ts` (function `errorToMessage(err, context)` per §6.6). `<ImageCardError/>`, `<RateLimitBanner/>`, wizard error tiles, and settings re-test failures all consume this one function. The `useErrorToast()` hook in the same file wraps the toast primitive for consistent surfacing.

**Error categorization helper.** `src/lib/round/failures.ts` also exports `isRetryable(err)`, `isAuthError(err)`, `isContentBlocked(err)` predicates so call sites don't `switch` on `kind` directly. Centralizing the predicates means a future ErrorKind addition only requires updating `failures.ts`.

---

## 11. Implementation phases (sequenced for the entire app)

Each phase produces something the user can interact with (or at minimum a reviewer can run). Phases sequence so integration risk surfaces early.

### Phase 0 — Pre-work (already done or near-done)
- [x] PRD, DDs, plans drafted.
- [ ] **Run CORS smoke test (§9.6) — blocks all subsequent phases.** Decision gate: if OpenAI blocks browser-origin calls, decide pivot per §9.6 before starting Phase 1. This is the single highest-risk pre-work item.
- [ ] Install missing shadcn primitives: `alert`, `radio-group`, `select`, `separator`, `tooltip`, `progress`, `scroll-area`, `sonner`. (`bunx shadcn@latest add ...`)
- [ ] Add runtime deps via bun: `ulid`, `idb`, `msw` (verify React 19 / Next 16 compatibility for the test stack — msw v2 uses native `fetch`/`Request` which Node 22 has natively, but jsdom 24 may not; pin versions accordingly).
- [ ] Confirm OpenAI image model identifier (§14.A).
- [ ] Confirm Gemini image model + endpoint version (§14.B).
- [ ] Confirm `gpt-image-2` reference-image endpoint (`/images/generations` vs `/images/edits`) and multi-reference support (§6.1, §14.A).
- [ ] **Build sanity check:** add `output: 'export'` to `next.config.ts` and run `bun run build` on the empty scaffold; confirm `out/` is produced cleanly with no SSR-incompatible warnings. Catches `output: 'export'` × Next 16 incompatibilities before any feature work depends on the deploy target (§14.AD).
- [ ] **Test setup scaffold:** add `vitest.config.ts`, `vitest.setup.ts` with `import "fake-indexeddb/auto"`, msw v2 `setupServer({})` placeholder, and a single trivial passing test. Confirms the testing toolchain (jsdom + fake-indexeddb + msw + bun-or-node runner per §14.AB) works before Phase 1 needs it. ~30 min.

### Phase 1 — Foundations (storage + types)

Output: types and storage utilities with full unit-test coverage. Nothing user-visible yet.

1. `src/lib/providers/types.ts` — Provider, Tier, ProviderConfig, AspectRatioConfig, etc.
2. `src/lib/providers/errors.ts` — NormalizedError, ErrorKind.
3. `src/lib/storage/schema.ts` — VucibleStorageV1 + IndexedDB schemas + `generateId()` ULID helper.
4. `src/lib/storage/keys.ts` — read/write/clear with the §5.1 aspect invariant enforced at write time.
5. `src/lib/storage/wizard-progress.ts`, `history.ts`, `purge.ts`.
6. Tests: storage round-trips, schema rejection, aspect invariant enforcement on write.

Estimate: 4 hr. Was 2.5 hr but `fake-indexeddb` setup, the `migrations.ts` registry scaffold (§14.Y), and the §14.V `idb` ArrayBuffer round-trip verification each add real time. Test setup (`vitest.setup.ts`, msw server, fake-indexeddb auto-import) is its own ~30 min one-time cost that lands in this phase.

### Phase 2 — Provider clients (OpenAI + Gemini wrappers) + error helpers

Output: `testGenerate`, `listModels`, `generate` functions for both providers + `errorToMessage` / `useErrorToast` / predicates, with mocked unit tests + a manual smoke-test script.

1. `src/lib/providers/tiers.ts`.
2. `src/lib/providers/openai.ts` — testGenerate + generate (basic, no references yet).
3. `src/lib/providers/gemini.ts` — listModels + generate (basic).
4. `src/lib/providers/openai.ts` — generate with reference images (multipart).
5. `src/lib/providers/gemini.ts` — generate with reference images (inline parts).
6. `src/lib/round/failures.ts` — `errorToMessage(err, context)`, `useErrorToast()`, `isRetryable`, `isAuthError`, `isContentBlocked` (built here so wizard in Phase 3 can use them).
7. **Manual smoke test** (`scripts/smoke.ts`): run with real keys, verify endpoints, header shapes, and error paths. Resolves §14.A and §14.B.
8. Unit tests with msw.

Estimate: 8 hr. Was 4.5 hr; pressure-test bumps it. **Highest-risk phase after Phase 0.** Reasons: (a) reference-image multipart for OpenAI is unverified and may need iteration vs. live API; (b) Gemini's inline-image base64 part shape is similarly unconfirmed; (c) header-name fallback logic (`-images` vs `-requests`) needs both code paths; (d) msw v2 mocking of multipart uploads is fiddlier than JSON; (e) error mapping coverage across 7 `ErrorKind`s × 2 providers × happy/sad paths is wider than it looks. If smoke test surfaces deviations from §14.A/B, add another 2–4 hr.

### Phase 3 — Setup wizard (FR-8)

Output: a working wizard you can complete end-to-end with real keys. App is "alive" but only renders the wizard.

Detailed sub-phases in `docs/plans/wizard.md` §12.

Estimate: ~8 hr (wizard plan total ~10 hr minus Phase 1 storage already done in master Phase 1, minus Phase 2 provider clients done in master Phase 2). Within the wizard slice, the riskiest sub-phase is Phase 4 (UI components, 3 hr in wizard.md) — that's 12+ components including discriminated-union-driven render branches; +1 hr buffer is warranted but absorbed in the slack already in the master estimate.

### Phase 4 — App shell + theme

Output: `<AppShell/>` renders after wizard, with TopBar, theme toggle, and a "Main app coming soon" placeholder. Theme persists across reloads. Mount-time orphan-round sweep clears any incomplete rounds from a prior session.

> **Bead dep note.** Step 5 below depends on Phase 1's `src/lib/storage/history.ts` being present — explicit dep edge.

1. `src/components/shell/AppShell.tsx`.
2. `<TopBar/>` with logo, history toggle (stub), theme toggle, settings gear (stub).
3. `<ThemeProvider/>` + `<ThemeToggle/>` with no-flash script.
4. Replace the wizard-slice `<MainAppPlaceholder/>` with `<AppShell/>`.
5. Orphan-round sweep wiring on `<AppShell/>` mount (§10.4) — calls into `history.ts` (Phase 1). Idempotent; failure is logged and tolerated.

Estimate: 3 hr. Was 2 hr; bumped because the no-flash theme script (`<head>`-injected inline script that reads localStorage and sets `<html class>`) interacts non-trivially with Next 16's App Router + `output: 'export'` — `next-themes` itself works but tuning to avoid a hydration warning under static export needs verification. Includes the orphan-round sweep wiring as step 5.

### Phase 5 — Settings page (FR-9)

Output: Settings dialog functional with auto-save-on-blur. Re-test, clear keys, change defaults, change concurrency cap, clear history.

1. `<SettingsDialog/>` shell with sections (auto-save pattern; no save button).
2. KeysPanel — reuses ProviderCard, adds Clear button.
3. DefaultsPanel — reuses pickers from wizard; each control writes to storage on blur/select.
4. ConcurrencyPanel — numeric inputs + hard cap + block-with-explainer.
5. HistoryPanel — storage estimate + Clear history.
6. Auto-save round-trip tests (write fails → field reverts + toast).

Estimate: 5 hr. Was 3.5 hr. Auto-save isn't the simplification it looks: every panel needs (a) blur-handler + value-change-detection (skip writes on no-op blur), (b) optimistic UI + revert-on-quota-failure with toast, (c) rapid focus-change debounce so tab-tab-tab doesn't fire three writes, (d) §14.U deferred re-validation logic stays out — but Keys panel's "Re-test" button reuses wizard validation including the ~$0.04 cost disclosure, which means the cost-disclosure component must already be wizard-shareable (forces a small refactor at this phase if it wasn't). Concurrency cap's hard-cap-with-explainer is two states (within / above), each with its own copy.

### Phase 6 — Round 1 generation (FR-2 + FR-4 + FR-11 + FR-5 grid render)

Output: type prompt → click Generate → 16 cards stream in with live progress banner. "New Session" button visible after first round. No selection wiring yet, no round 2.

> **Bead split note for `beads-workflow`.** This is the largest phase. Convert each numbered sub-bullet below to its own bead (do not bundle). Sub-bullets 4 and 5 are themselves multi-step — split further on conversion as noted inline. Estimated total bead count for this phase: ~10.

1. `src/lib/round/throttle.ts` — `ProviderThrottle` class per §6.4; expose `inflight()`, `queued()`, `setCap()`, `seedConsumed()`. Tests with vitest fake timers.
2. `src/lib/round/retry.ts` — `withRetry` per §6.5 including `MAX_RETRY_AFTER_MS` cap. Tests for retry budget exhaustion + Retry-After honoring.
3. `src/lib/round/image-cache.ts` — `ImageCache` + `ThumbnailCache` refcounted LRU per §10.4; revoke-on-zero-refcount; cap at 96 / 256.
4. `src/lib/round/thumbnails.ts` — `generateThumbnail(bytes, mime): Promise<{thumbnail: ArrayBuffer; mimeType: 'image/jpeg'}>` using `OffscreenCanvas` with `HTMLCanvasElement` fallback. The *generator* lands here in Phase 6 so settle-time thumbnail creation works; the *consumer* (`<RoundCard/>` rendering thumbnails) is Phase 8.
5. `src/lib/round/orchestrate.ts` — `startRoundOne()` per §10.4 steps 1–9. Split for beads as: (a) input validation + slate compute + eager-intent placeholder write; (b) fan-out + per-slot terminal-state stream into in-memory state; (c) settle path: thumbnail generation + batched single-transaction write.
6. `<RoundProvider/>` — context exposing `{ round, isRunning, done, total, queued }` derived state. Live `inflight()`/`queued()` subscription needs an `EventTarget` emitter on `ProviderThrottle` (or polling tick) — pick the emitter approach. Track `consecutive429Count` per provider for §10.11 banner detection (banner UI itself is Phase 9).
7. `useRoundForm()` hook + `<PromptArea/>` — prompt textarea + `<ModelToggle/>` + `<AspectRatioPicker/>` + `<ImageCountPicker/>` + Generate + `<NewSessionButton/>` (visible once ≥1 round settled). Reducer must reject all actions when `isRunning` (§10.6 form-lock).
8. Stable per-slot keys for streaming render: derive composite key `${roundId}:${provider}:${index}` (slots are not IDed in §5.3 schema — do not add a `slotId` field; derive at render time).
9. `<ResultGrid/>` with global progress banner + `<ImageCard/>` shell + `<ImageCardLoading/>` / `<ImageCardSuccess/>` / `<ImageCardError/>` states. `<ImageCardSuccess/>` wires to `ImageCache` via `useEffect` mount/unmount.
10. BFCache `pageshow` listener per §9.4.1 — lands here, NOT in Phase 4, because it depends on `ImageCache` existing (per §14.AC).
11. Test-gen seed handoff: when wizard completes, call `throttle.seedConsumed(1, 60_000)` per §10.4 / §14.X.
12. Eager-intent placeholder write on round start (single transaction); batched settle write that overwrites the placeholder with full results + thumbnails.

Estimate: 14 hr. Was 9 hr. Pressure-test bumps it hard. This is the **highest-complexity phase** in the plan and the one most likely to slip. Hidden costs:
- Streaming into the grid is not `useState + map` — it needs stable per-slot keys (slots aren't IDed in §5.3; either add `slotId` to `RoundResult` or derive a stable composite key `${roundId}:${provider}:${index}`), AnimatePresence-equivalent fade-in via tw-animate-css, ImageCache subscription/release in `useEffect`, and per-slot retry button wiring. Probably wants its own reducer instead of `useState`.
- Throttle queue ordering tested with vitest fake timers + Promise scheduling is a known flake source — `await vi.runAllTimersAsync()` between actions, plus careful handling of the microtask queue. Budget 1.5 hr for tests alone.
- `OffscreenCanvas` thumbnail generation has a `HTMLCanvasElement` fallback path; both paths need real-image testing (jsdom canvas is a known hole; tests must use a real Blob → ImageBitmap pipeline or skip-in-jsdom + run in playwright).
- Eager intent persistence + batched settle write means two distinct IndexedDB transactions per round; failure of either is an edge case (placeholder write fails → user gets no in-flight visual, but generation proceeds; settle write fails → toast + user can save individual images). Both paths need explicit handling.
- Live progress banner derived state subscribing to `throttle.inflight()` + `throttle.queued()` — those aren't React state; need either a polling tick or `EventTarget`-style emitter on `ProviderThrottle`. Add ~1 hr.
- Test-gen seed (§10.4) handoff from wizard to round throttle.

### Phase 7 — Selection + commentary + round 2+ (FR-3 + FR-5 selection)

Output: pick favorites, type commentary, click Evolve → round 2 generates with reference images.

1. `<SelectionOverlay/>` + selection state (typed as `{provider, index}[]`).
2. `<CommentaryInput/>`.
3. `src/lib/round/prompt.ts` — DD-015 template builder (round-2 vs round-N templates).
4. `prepareReferences()` helper (§10.5) — single-encode-share-many for OpenAI Blobs and Gemini base64.
5. Round 2+ orchestrator with prompt history; reuses the eager-intent + batched-settle persistence pattern.

Estimate: 8 hr. Was 6 hr. `prepareReferences` is a single-encode-share-many helper but exercises Blob construction, base64 encoding (browser-native `FileReader` or `Uint8Array → btoa` chunking — naive `btoa(String.fromCharCode(...arr))` blows the call stack on >~100 KB), and provider-specific re-shape. DD-015 prompt builder has multiple template branches plus the `MAX_PROMPT_CHARS` overflow-collapse logic; tests need synthetic 20-round histories. Selection state machine isn't trivial: 5th-click no-op + shake animation + only-success-clickable + per-round selections audit-trail-into-prior-round on Evolve.

### Phase 8 — History (FR-6)

Output: history rail with current-session rounds + cross-session list. Read-only on past rounds. Renders thumbnails only — never holds full bytes for non-active rounds.

1. `<HistoryRail/>` + `<RoundCard/>` mini-thumbs (rendered from `Round.openaiResults[*].thumbnail` and `Round.geminiResults[*].thumbnail`; full `bytes` never loaded for non-active rounds).
2. `ThumbnailCache` (sibling of `ImageCache` from Phase 6, same lifecycle pattern).
3. Cross-session list.
4. `<ScrollBackPanel/>` read-only view (loads full bytes only for the visible round; releases on scroll-away).

Estimate: 5 hr. Was 4 hr. Cross-session list + read-only `<ScrollBackPanel/>` is its own scroll-container mini-app; loading full bytes only for the visible round and releasing on scroll-away requires `IntersectionObserver` wiring per RoundCard. ThumbnailCache mirroring ImageCache is straightforward but tests need to verify revoke-on-eviction.

### Phase 9 — Failure handling polish (FR-10)

Output: comprehensive error UI verified across all error types; rate-limit banner.

1. `<ImageCardError/>` per-kind messages (DD-019 mapping verified).
2. Click-to-regenerate per failed slot with fresh 3x retry budget.
3. `<RateLimitBanner/>` triggered after 3 consecutive 429s on a provider.
4. Manual fault injection (mock provider responses).

Estimate: 3 hr.

### Phase 10 — Export + zoom (FR-7 + image preview)

Output: download images, zoom modal works.

1. Download icon + filename builder.
2. `<ImageZoom/>` modal with prev/next nav.

Estimate: 2 hr.

### Phase 11 — Accessibility, perf, polish

1. Full keyboard-only walkthrough.
2. `prefers-reduced-motion` honored.
3. ARIA roles/labels.
4. Performance pass (Lighthouse, profiling) — verify `ImageCache` + `ThumbnailCache` revoke object URLs on unmount; no DevTools "detached" leaks after extended history navigation.
5. Error boundary verification.
6. Manual cross-browser smoke (Chrome / Firefox / Safari).

Estimate: 8 hr. Was 4 hr. A11y pass on a 12-step wizard + main canvas + grid + selection overlay + history rail + settings dialog is meaningful surface; Lighthouse perf on the wizard/empty-grid landing has to actually clear ≥90 (target in §16) which often requires shaking out unused JS, deferring shadcn primitives, etc. Cross-browser smoke on Chrome/Firefox/Safari finds at least one Safari-specific bug 80% of the time (PWA-ish IndexedDB quirks, BFCache divergence per §9.4.1, OffscreenCanvas availability).

### Phase 12 — Deploy (FR — DD-020)

1. Verify `next.config.ts` has `output: 'export'`.
2. Connect repo to Vercel; configure project; first deploy.
3. Set up custom domain (optional v1).
4. Smoke-test the deployed build with real keys.

Estimate: 2 hr.

### Total estimate

After round-6 pressure-test: **~73 hours** of focused work for v1 (re-summed: 4 + 8 + 8 + 3 + 5 + 14 + 8 + 5 + 3 + 2 + 8 + 2 = 70 hr, plus ~3 hr ambient slack for Phase 0 CORS smoke + decision-gate handling). Original round-5 estimate was ~50 hr; the 46% bump reflects:
- Phase 6 (round generation) underweighted streaming/keys/throttle-events (+5 hr).
- Phase 2 (provider clients) undersized given multipart unknowns (+3.5 hr).
- Phase 11 (a11y/perf/cross-browser polish) systematically junior-estimated (+4 hr).
- Phase 7 (round 2+) reference encoding has hidden CPU subtleties (+2 hr).
- Smaller bumps elsewhere.

Calibration: junior or first-time-with-stack engineer should expect another +30%; senior with prior Next 16 / React 19 / shadcn-base-ui exposure can hit the 73 hr number. Estimate excludes the open-question discovery work (real-key smoke tests, CORS pivot decision) which adds 1–6 hr depending on what surfaces.

---

## 12. Testing strategy

### 12.1 Test framework decisions

- **Unit / component**: vitest + @testing-library/react + jsdom (Next 16 compatible, fast, ESM-native).
- **HTTP mocking**: msw (lets us mock provider responses at the network layer).
- **E2E**: playwright (one run per major branch; skip on every commit).
- **Visual regression**: deferred. v1 doesn't need it.

### 12.2 What we test where

**Unit** — anything pure or near-pure:
- Storage parsers (`schema.ts`).
- Tier mapping (`tiers.ts`).
- Prompt builder (`prompt.ts`) — every template variation.
- Error normalizers (`errors.ts`).
- Throttle queue ordering and capacity.
- Retry logic (timing assertions with vitest fake timers).

**Component** — render + interaction:
- Wizard steps render correctly per state.
- ProviderCard validation states.
- ResultGrid card states (loading / success / error).
- SelectionOverlay click + cap.
- AspectRatioPicker form switch.

**Integration** — multi-component flows mocked at the network layer:
- Full wizard happy path with msw.
- Round 1 generation with mocked providers — verify cards stream.
- Round 2 with reference images.
- 429 storm triggers banner.

**E2E** — real browser, real flow (still mocked APIs unless explicitly e2e-real):
- Wizard → settle → round 1 → select → round 2 → settle.
- Settings: change concurrency cap → next round respects it.
- Clear history → IndexedDB empty.

**Manual** — anything dependent on real provider APIs:
- Wizard with real OpenAI key on Tier 1 → tier detected as Tier 1.
- Wizard with real Gemini key (paid) → user-declared works.
- Real round 1 with both providers → 16 images appear.
- Real round 2 with reference images → models honor refs.

### 12.3 What we don't test

- Visual regression (deferred).
- Performance regressions (no automated harness in v1; manual Lighthouse passes).
- Accessibility automated checks (manual axe-devtools pass instead).

---

## 13. Deployment (DD-020)

**Target**: Vercel via GitHub integration, static export.

`next.config.ts`:
```ts
const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true }, // static export disables next/image optimization; we use raw <img>
  // No other deployment-specific config; envs are absent (BYOK, no server)
};
```

**Build**:
```bash
bun run build
```

Produces `out/` directory with the static site. Vercel auto-deploys on push to `main`.

**Custom domain**: deferred. Default `vucible-<hash>.vercel.app` is fine for early access.

**Telemetry**: none in v1 (DD-001). No Vercel Analytics, no Speed Insights. Add later if traffic justifies.

---

## 14. Open questions

These block implementation if unresolved. Each has a recommended lean.

### ~~A. OpenAI image model identifier + reference-image endpoint shape (§6.1)~~ — PARTIALLY RESOLVED

**Confirmed (2026-04-30 research):**
1. **Model string:** `gpt-image-1` is the safe/available model. `gpt-image-1.5` also available. `gpt-image-2` launched 2026-04-21 but developer API access opens early May 2026 — may not be available yet. **Use `gpt-image-1` for MVP; upgrade to `gpt-image-2` when API access opens.**
2. **Reference-image endpoint:** `gpt-image-1` unified generation+editing under `POST /v1/images/generations` with optional `image` field. Expect same for `gpt-image-2`. Confirmed by docs.
3. **Multi-reference:** Unconfirmed for `gpt-image-2`. Plan B (composite K images into single grid) remains fallback. Resolve during Phase 2 smoke with real keys.
4. **`response_format`:** `gpt-image-1` supports `b64_json`. Confirm on `gpt-image-2` during Phase 2 smoke.
5. **Rate-limit headers:** `x-ratelimit-limit-requests` confirmed. `-images` variant unverified — Phase 2 smoke test records actual headers.
6. **CORS:** `api.openai.com` returns `Access-Control-Allow-Origin: *` on success responses. **Gotcha:** 401 responses from Cloudflare edge do NOT include CORS headers — browser sees opaque error. Handle gracefully in key validation (wizard must catch "Failed to fetch" as possible invalid key, not just CORS block).

### ~~B. Gemini image model + endpoint version (§6.2)~~ — RESOLVED

**Confirmed (2026-04-30 research):**
1. **Model string:** `gemini-2.5-flash-image` (recommended, production). Also available: `gemini-2.0-flash-preview-image-generation`, `gemini-3.1-flash-image-preview` (newer, 4K output). **Use `gemini-2.5-flash-image` for MVP.** Note: this is a Gemini-native image model, NOT the separate Imagen API (deprecated June 2026).
2. **Endpoint version:** `v1beta` for generateContent with image output. `v1` for list-models (auth validation). The image generation models require `v1beta`.
3. **CORS:** `generativelanguage.googleapis.com` mirrors `Origin` header in `Access-Control-Allow-Origin` (better than OpenAI — error responses also include CORS headers, so browser can read error messages).
4. **Reference image encoding:** Inline base64 parts in the `contents[].parts[]` array with `{ inlineData: { mimeType: "image/png", data: "<base64>" } }`. Works from browser.
5. **Image output:** Requires `generationConfig: { responseModalities: ["Text", "Image"] }`. Image-only output NOT supported; must include both Text and Image modalities.
6. **Auth:** Both `?key=` query param and `x-goog-api-key` header work. Prefer header for security (keys don't appear in server logs).

### C. Test-gen prompt content (`docs/plans/wizard.md` §15.C)

Lean: `"a single solid color square"`. Confirm doesn't trigger 422 on any tier.

### D. Storage corruption recovery (`docs/plans/wizard.md` §15.D)

Lean: detect malformed → show explanatory banner in wizard step 1, then proceed.

### E. Wizard 422 fallback (`docs/plans/wizard.md` §15.E)

Lean: let user proceed with key validated-but-tier-unknown, defaulting to Tier 1 cap.

### F. Hydration approach (`docs/plans/wizard.md` §15.F)

Lean: server-shell + client-gate.

### ~~G. Test framework~~ — RESOLVED

Locked: vitest + @testing-library/react + jsdom + msw + playwright. Confirmed in §12.

### ~~H. IndexedDB image format~~ — RESOLVED

Locked: ArrayBuffer + MIME (per §5.3). Display via `URL.createObjectURL(new Blob([buffer], {type: mime}))` lazily; `ImageCache` (§10.4) owns the lifecycle.

### ~~I. Round 2+ reference image storage location~~ — RESOLVED

Locked: already in IndexedDB from round 1; round 2+ engine reads them directly via `prepareReferences` (§10.5). No separate cache.

### ~~J. Model toggle persistence across rounds in a session~~ — RESOLVED

Locked (§10.6): persists in `<PromptArea/>` memory across rounds within a session; resets when "New Session" is clicked. New session is an explicit button (§14.N below also resolved).

### ~~K. Aspect ratio carry-forward across rounds~~ — RESOLVED

Locked: aspect carries forward by default; user can override per round. Picker is pre-populated from the previous round's `aspect` on round-N entry (§4.4 step 4).

### ~~L. Selection clear behavior on Evolve~~ — RESOLVED

Locked: on Evolve, selections persist into the prior round's `Round.selections` (read-only audit trail in history); the new round's grid starts with no selection. The `selections` write happens in the same batched-settle transaction that flips the prior round to settled. Implemented in `orchestrate.ts` round-N entry path.

### ~~M. Refresh mid-round behavior~~ — RESOLVED

Locked (§10.4): eager intent placeholder written to IndexedDB on round start; on refresh, the round is treated as terminated (no in-flight re-attempts; failed slots get error tiles with Regenerate per DD-019). Resolves the double-charge concern.

### ~~N. New-session UX~~ — RESOLVED

Locked (§10.4): explicit "New Session" button in `<PromptArea/>` once ≥1 round is settled in the current session. Confirms before starting a new session if the current round hasn't settled.

### O. Mobile scope

PRD §2 has been silent. Lean: desktop primary, responsive but not phone-optimized — captures Tier 1 latitude without committing engineering work.

### P. Beyond-v1 hooks

What to leave as TODOs vs. delete: feature-flagged "branching history" stub? Lean: no stubs. Delete what's not in v1; rebuild later if needed.

### Q. Accessibility audit gate

Should v1 require automated axe pass before merge to main? Lean: manual axe-devtools pass on each major slice; no automated gate.

### R. Throttle/retry slot release on long Retry-After (§6.5)

Current pattern holds throttle slots for the entire retry chain, including `Retry-After` waits. Acceptable for v1 (rationale in §6.5). Profile after launch — if real-world latency profiling shows hold-the-slot is a meaningful contributor, refactor to release-and-re-enqueue with a `throttle.pauseFor()` mechanism. v2 candidate.

### S. Private-browsing UX (§9.5)

Detection is unreliable and behaves differently across browsers. Three options: (a) silently best-effort (current lean) — keys persist for the tab session, history wipes on close; (b) detect and show a non-blocking banner; (c) detect and refuse to enter the wizard until the user opens a non-private tab. Lean: (b). Decide before Phase 3.

### T. CORS browser-origin viability (§9.6) — load-bearing — ~~RESOLVED: T1~~

**Outcome: T1 — both providers allow browser-origin calls. No proxy needed. Plan proceeds unchanged.**

Verified 2026-04-29 via `src/__tests__/cors-smoke.test.ts` (7 assertions, all pass, junk keys). Results:

| Endpoint | Method | HTTP | CORS `Access-Control-Allow-Origin` |
|---|---|---|---|
| OpenAI `/v1/images/generations` | OPTIONS preflight | 200 | `*` (+ allow-methods, allow-headers) |
| OpenAI `/v1/images/edits` | OPTIONS preflight | 200 | `*` |
| OpenAI `/v1/models` | GET (401 junk key) | 401 | `*` |
| OpenAI `/v1/images/generations` | POST (401 junk key) | 401 | **null** (Cloudflare strips on 401) |
| Gemini `/v1/models` | GET (400 junk key) | 400 | exact origin |
| Gemini v1beta `generateContent` | OPTIONS preflight | 200 | exact origin |
| Gemini v1beta `generateContent` | POST (400 junk key) | 400 | exact origin |

**Gemini: fully CORS-clean.** All endpoints return proper CORS headers even on error responses.

**OpenAI: CORS-clean for the happy path.** Preflights pass (`Access-Control-Allow-Origin: *`), and valid-key 200 responses will have CORS headers. One caveat: Cloudflare strips CORS headers on 401 responses to the image endpoints (but NOT to `/v1/models`).

**Caveat impact on wizard validation (DD-022):** The wizard's `testGenerate` call uses `/v1/images/generations`. If the user enters a bad key, the 401 response is CORS-opaque in a browser — JS sees a generic `TypeError: Failed to fetch`, not a clean JSON error. **Workaround:** validate the key first via `GET /v1/models` (CORS-clean on 401, reads the error body), then only call `testGenerate` once the key is confirmed valid. This adds one extra free call to the wizard validation path but eliminates the opaque-error UX problem. Provider client should implement: `validateKey()` (via `/v1/models`) → if ok → `testGenerate()` (via `/v1/images/generations`) for tier detection.

### U. Stale `validatedAt` re-validation policy

Current plan: keys validated once and trusted until the user manually re-tests in Settings. A revoked key returning a 401 mid-round is handled by DD-019's auth_failed path. Open: should we re-validate on app launch if `validatedAt` is older than X days? Lean: **no auto-revalidation** in v1 — re-validation costs $0.04 (OpenAI test-gen) per launch, accumulating silently. The 401 path on first round-1 call is a sufficient signal; user re-pastes via Settings. Confirm before Phase 4.

### V. Persistence semantics of `bytes: ArrayBuffer` via `idb`

`idb`'s `put()` calls structuredClone under the hood. ArrayBuffer is cloneable (not transferred) by default unless we explicitly opt into a transfer. Confirm via Phase 1 storage round-trip test: write a Round, mutate the in-memory ArrayBuffer post-write, read back from IDB — bytes should be unchanged. If transfers do occur (e.g. inside an Object containing an ArrayBuffer, semantics get weird), wrap bytes in a Blob before IDB write. Cheap to verify, expensive to discover late.

### W. Cross-tab throttle coordination (§9.5.1)

V1 ships per-tab throttles with a `BroadcastChannel` warning banner when another tab claims an active round. True cross-tab coordination (shared throttle lease via `SharedWorker` or a leader-election BroadcastChannel protocol) is deferred to v2. Open: should v1 also gate the Generate button when a sibling tab is mid-round? Lean: **no hard gate**, only the warning — soft-blocking the user when they have two tabs open by choice is more annoying than the spurious 429s it prevents. Revisit if telemetry (post-v1) shows multi-tab usage is common.

### X. Test-gen seed cross-tab leak (§10.4)

The post-wizard "throttle has 1 slot consumed for next 60s" seed lives only in the tab that ran the wizard. A user who completes the wizard then immediately opens a second tab to start their first round from there will not have the seed — Tier 1 user sees a spurious 429 on the first card. Fix would require persisting the seed via localStorage with TTL and rehydrating in any tab on `<AppShell/>` mount. Lean: **acknowledge, defer**. The 429 retries cleanly; the user-facing impact is a 30s delay on the first card of the first round in this narrow flow. Revisit only if real-world reports surface.

### Y. Schema migration vs corruption (parse-fail) distinction

§14.D leans toward "treat malformed → wizard runs with banner". As written, that path also fires for **valid but older** schema versions — so a v2 upgrade that bumps `schemaVersion` would silently force every returning user back through the wizard and lose their history (IndexedDB stays, but the keys/defaults blob is wiped). Plan should distinguish:
- `schemaVersion` missing or unparseable JSON → treat as fresh install, run wizard.
- `schemaVersion < CURRENT_VERSION` → run a registered migration from `src/lib/storage/migrations/v{N}-to-v{N+1}.ts`. v1 has no migrations to write, but the migration *registry* and the version-gate logic must exist from day one; otherwise v2 is a breaking release for every user.

Lean: scaffold `migrations.ts` with an empty registry in Phase 1; document the contract. Confirm before Phase 1 ships.

### Z. Clock skew on persisted timestamps

`startedAt`, `settledAt`, `validatedAt`, `createdAt` are all `new Date().toISOString()` — local clock. Failure modes: (a) NTP correction mid-round → `settledAt < startedAt`; (b) user has a wildly wrong clock → ULIDs (which encode time) and ISO timestamps both wander; (c) DST transition mid-round → no functional impact since ISO-8601 is UTC, but log-readability suffers. Lean: **accept**. We don't compare timestamps across users (no backend); all comparisons are within one device's clock domain. Sort orders only break if the clock jumps backward by more than the round duration — rare. Document the assumption in the storage module's header comment so a future maintainer doesn't add cross-device sync without revisiting.

### AA. Gemini Free tier — trust the user

Wizard asks the user to self-declare their Gemini tier (DD-022). A user who recently added billing but picked "Free" out of habit gets the false-warning UX (*"Free tier doesn't include image gen"*). Reverse case: user picks a paid tier they don't actually have → 429s in production. We **do not auto-test** the Gemini tier (would cost money and defeats the free `list-models` validation). Lean: **document as "user is responsible for accurate self-declaration"** in copy near the dropdown; show the warning only if Free is picked; do not block. Confirm before Phase 3.

### AB. Test runner choice for vitest

Two options: (a) `bunx vitest` (uses Bun as the runner — fast, but the bun+vitest combo has had transient bugs around module mocking and `vi.mock` hoisting); (b) `bun run vitest` invoking the package script which runs vitest under Node directly. Lean: **(b)** for stability — the speed difference is negligible at this project's test count, and msw v2 + jsdom + fake-indexeddb has more documented Node-runner support. Confirm before Phase 1's first test file.

### AC. Phase-dependency map (cross-phase deps not in single-phase descriptions)

A rendered dependency graph would help beads-workflow ingestion:

- Phase 6 round generation depends on Phase 2's `errorToMessage` / `useErrorToast` / predicates — **already moved to Phase 2** in §11.
- Phase 6 needs the thumbnail-creation function (§10.4 step 9 generates thumbnails on settle); the `ThumbnailCache` *consumer* is Phase 8 but the *generator* is Phase 6. Confirm the generator function lives in `src/lib/round/thumbnails.ts` and is built in Phase 6, with `ThumbnailCache` (read-side) deferred to Phase 8.
- Phase 4 (`<AppShell/>`) depends on Phase 1's `history.ts` for the orphan-round sweep on mount — already implicit in the phase ordering.
- Phase 5 (Settings) Keys panel reuses the wizard's `<ProviderCard/>` and `<CostDisclosure/>` — confirms wizard build-out is complete enough by Phase 3 to expose these.
- Phase 9 (`<RateLimitBanner/>` triggered after 3 consecutive 429s) — the *banner component* is Phase 9, but the *3-consecutive-429 detection state* must live somewhere stateful; lean: track in `<RoundProvider/>` from Phase 6, surface boolean to the banner consumer in Phase 9. Phase 6 builds the detector; Phase 9 builds the banner UI.

Not tracked anywhere as a dependency: the BFCache `pageshow` listener (§9.4.1) — needs `<AppShell/>` (Phase 4) and the `ImageCache` (Phase 6) to coexist, so it lands in Phase 6, not Phase 4. Note this in the Phase 6 task list when it converts to beads.

### AD. `output: 'export'` + Next 16 App Router compatibility

DD-020 + Next 16's App Router specify static export. Plan asserts this works without proving it. Concrete unknowns:
- `next.config.ts` with `output: 'export'` + a `"use client"` root client gate (`<WizardOrApp/>`) + `next/dynamic({ ssr: false })` chunk-splitting for wizard vs. app (§9.2). Build time: does `next build` produce a clean `out/` with both chunks? Does it fail because the dynamic import path tries to be SSR'd?
- `output: 'export'` forbids: route handlers, middleware, `cookies()` / `headers()`, `dynamicParams: true` route segments. Plan does not use any of these — confirm by greppping the codebase pre-Phase-12.
- `images.unoptimized: true` is set; native `<img>` tags will be used. Verified mention; no follow-up.
- Lean: **add a Phase 0 sub-task: `bun run build` on the empty scaffold to confirm `output: 'export'` succeeds before any feature work.** 5 min, prevents Phase 12 surprise.

---

## 15. Out of scope for v1

(Recap from PRD §5 + plan-specific cuts.)

- Branching history / undo / re-pick favorites from round N.
- Animation-style pickers, structured-input UI for non-aspect parameters.
- LLM-mediated prompt diversification.
- Cross-device sync.
- Sharing, collaboration, public galleries.
- Model routing intelligence ("OpenAI for logos, Gemini for photos").
- Auth, accounts, payments.
- Per-call cost display.
- Free tier with hosted OSS image gen.
- Automatic history GC.
- Mobile-optimized layouts.
- Telemetry / analytics.
- i18n.

---

## 16. Acceptance criteria for v1

The app is "v1-done" when:

1. A new user with no keys completes the wizard, lands on the main app, types a prompt, clicks Generate, and receives 16 streaming images split 8/8 across OpenAI and Gemini. **Pass test:** with both providers configured at any tier, the resulting `Round` record in IndexedDB has `openaiResults.length === 8` and `geminiResults.length === 8` and `≥ 14 of 16` slots have `status === "success"` on the happy path (allows 2 sporadic provider failures).
2. Selecting 1–4 favorites + optional commentary + clicking Evolve produces a round 2 whose request payload (DevTools network tab) includes the selected reference images. **Pass test:** for OpenAI, the multipart `POST` body contains N image parts where N = number of selected slots; for Gemini, the JSON body contains N inline `image/*` parts. Visual continuity is qualitative and not a pass criterion.
3. At least 5 rounds in a single session — history rail shows all of them; full-page refresh preserves history. **Pass test:** after refresh, `<HistoryRail/>` lists all 5 rounds with their thumbnails, and each round's "view" loads the full bytes from IndexedDB.
4. Failure paths produce the kind-specific copy from `errorToMessage` (per §6.6 mapping):
   - Bad key → `<ImageCardError/>` shows the `auth_failed` copy ("Invalid API key. Re-check…").
   - 3 consecutive 429s on a provider → `<RateLimitBanner/>` mounts with the rate-limit copy.
   - Content policy hit (422) → `<ImageCardError/>` shows the `content_blocked` copy + Regenerate button.
   - Provider 5xx storm → all that provider's slots are `error` after retry-3x; toggling the provider off + Generate again produces a clean single-provider round.
5. Settings: change concurrency cap, change default image count, change default aspect, clear history, clear keys. **Pass test:** each change is reflected in `localStorage["vucible:v1"]` immediately after blur (no Save button); "Clear history" sets IndexedDB stores to empty; "Clear keys" wipes the localStorage blob and renders the wizard on next mount.
6. Theme toggle persists across reloads with no flash. **Pass test:** with theme set to dark and the page reloaded, the `<html>` element has `class="dark"` set *before* React hydration (verified by the no-flash inline script firing pre-React).
7. `bun run build` produces a clean static export. Vercel deploy succeeds. Real-key smoke test on the deployed URL passes the happy path. **Pass test:** zero CI errors; `out/` directory exists after build; manual happy-path round on the live URL.
8. Lighthouse desktop scores **on the wizard / empty-grid landing**: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 80. Lighthouse on a settled 16-image grid is explicitly *not* a target — 16 large `<img>` tags loaded simultaneously will tank the perf score regardless of what we do, and adding lazy-load / virtualization for in-canvas images would degrade the streaming UX (DD-009). Track a separate manual **TTFM** (time to first mounted card) budget of ≤ 1 s post-Generate-click — measured by stopwatch, not a Lighthouse metric.

---

## 17. Glossary

- **BYOK** — Bring Your Own Key. User provides API keys; we never proxy or store server-side. (DD-001)
- **IPM** — Images Per Minute. Rate-limit dimension throttling parallel image gen. (DD-016)
- **Tier** — OpenAI's usage-graduated rate-limit class (Tier 1 → Tier 5).
- **Test-gen** — Wizard validation call (small image gen) that detects tier from headers. (DD-022)
- **List-models** — Free auth-validation call for Gemini.
- **Round** — One generation pass: prompt → N parallel calls → N image slots → user picks favorites.
- **Session** — A chain of rounds starting from one initial prompt.
- **Evolve directive** — The single-line instruction in the round-2+ prompt telling the model to use the references. (DD-015)
- **Settle** — All slots in a round reach a terminal state (success or failed-after-retries). Selection unlocks.
- **Throttle slot** — A concurrent inflight call. Capped per provider.
- **Snap** — Auto-mapping of an arbitrary aspect ratio to the nearest Gemini-supported one. (DD-023)
- **ULID** — Universally Unique Lexicographically Sortable Identifier. 26-char base32, encodes time. Used for `Round.id` and `Session.id` so "most recent" sort is just a key sort. (§5.3)
- **BFCache** — Browser back/forward cache. Safari and Firefox preserve a navigated-away page's full JS state for instant restore on Back; restored via `pageshow` with `event.persisted === true`. (§9.4.1)
- **CORS** — Cross-Origin Resource Sharing. The browser's enforcement of `Access-Control-Allow-Origin` headers when JS calls a different origin. The viability of browser-origin calls to OpenAI / Gemini is the largest unverified bet in the plan. (§9.6, §14.T)
- **Eager intent persistence** — Writing a placeholder `Round` record to IndexedDB the moment a round starts, before any provider call settles, so a mid-round refresh can recover instead of orphaning. (§10.4 step 6)
- **Orphan-round sweep** — `<AppShell/>` mount-time pass that converts any `Round` with `settledAt === null` into a terminated round with `error` slots. Cleans up after refresh or tab-close mid-round. (§10.4)
- **TTFM** — Time to First Mounted card. Manual budget (≤ 1 s post-Generate-click) tracked separately from Lighthouse; replaces a misleading Lighthouse-on-settled-grid score. (§16)
- **Test-gen seed** — A 1-slot reservation primed in the OpenAI throttle right after wizard validation, accounting for the test-gen call's IPM consumption so the first round's first card doesn't 429. (§10.4, §14.X)
- **Snap helper** — `snapAspectIfNeeded(aspect, providers)` in `lib/round/aspect.ts`; the single function that enforces the §5.1 aspect invariant. Called from picker reducer, `startRound*`, and `setStorage`. (§5.3.1, §10.7)

---

## 18. Review notes (historical)

(Originally "Review notes for round 2" in the round-1 draft. Retained for trail; superseded by §19.)

Per the planning-workflow methodology, the original recommended next steps were:

1. **Self-review pass** (Claude reading own work) — surface internal contradictions, missing dependencies, undersized risk items.
2. **GPT-Pro Extended Reasoning review** with the skill's exact review prompt — catches gaps the author missed; revisions integrated via the skill's exact integrate-revisions prompt.
3. **Optional multi-model blend** — Gemini Deep Think + Grok Heavy + Opus 4.5 for adversarial coverage. GPT-Pro as final arbiter.
4. **Convert to Beads** via `beads-workflow` once steady-state — each Phase task becomes a bead, with dependencies between phases preserved.
5. **Polish beads** through 6+ rounds.

After polish: implementation begins with a fan-out across phase-1 dependencies.

---

## 19. Plan refinement complete

This plan has been through 7 rounds of review:
- Round 1: initial draft
- Round 2: external reviewer feedback (paste-in)
- Round 3: internal consistency sweep
- Round 4: adversarial pushback
- Round 5: edge case + failure mode sweep
- Round 6: implementation realism check
- Round 7: handoff readiness

Next step: convert §11 phases to beads via the `beads-workflow` skill, then implement.

**Critical-path notes for the converter:**
- Phase 0's CORS smoke test (§9.6 / §14.T) is the single decision gate — no Phase 1 work is salvageable if the architecture has to pivot to a proxy.
- Phase 6 is the largest phase (14 hr) — split into ~10 beads per the inline note in §11.
- Each numbered §11 sub-bullet is one bead; bundle nothing.
- Bead-dep graph hints documented in §14.AC; preserve those edges on conversion.
