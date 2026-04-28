# Vucible — Master Implementation Plan

> **Status:** Round 2 (external reviewer feedback integrated)
> **Date:** 2026-04-27
> **Scope:** Entire app, v1. Sits *above* `docs/PRD.md` (the WHAT) and `docs/DESIGN_DECISIONS.md` (the WHY) as the HOW — integration shapes, file paths, data flows, sequencing.
> **Companion plans:**
> - `docs/plans/wizard.md` — detailed plan for FR-8 (referenced from §10.2 below; not duplicated here)
>
> This plan is the source of truth for handoff to `beads-workflow`. Each item in §11 (Implementation Phases) becomes a `br create` candidate.

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
│   │   ├── ModelToggle.tsx    # FR-4
│   │   ├── ImageCountPicker.tsx
│   │   ├── AspectRatioPicker.tsx  # shared with wizard/settings (FR-11 / DD-023)
│   │   ├── GenerateButton.tsx
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
│   │   ├── orchestrate.ts     # top-level: split call slate, fan out, stream results
│   │   └── failures.ts        # categorize errors → retryable / terminal
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
| shadcn/ui | 4.5+ | already installed primitives: badge, button, card, dialog, input, label, switch, tabs, textarea, toggle-group, toggle. **Need to add:** alert, radio-group, select, separator, tooltip, progress, scroll-area. |
| icons | lucide-react | already in scaffold |
| package manager | bun | per AGENTS.md — never npm/yarn/pnpm |
| linting | eslint (next core-web-vitals) | scaffold default |
| testing | vitest + @testing-library/react + jsdom | confirm in §12 |
| E2E | playwright | confirm in §12 |
| HTTP mocking | msw | for unit tests of provider clients |
| IndexedDB wrapper | `idb` (Jake Archibald) | tiny promise wrapper; avoids hand-rolled callback hell |
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

### 5.2 `localStorage["vucible:v1.wizard"]` (scratchpad)

See `docs/plans/wizard.md` §6.2.

### 5.3 IndexedDB — `vucible-history` database, version 1

Two object stores:

#### IDs

All `id` fields use **ULID** (lexicographically sortable, 26-char base32, encodes timestamp). Library: `ulid` (npm, ~1 KB, no deps). Helper `generateId()` lives in `src/lib/storage/schema.ts` and is the single source of truth for ID generation. We do not use `crypto.randomUUID()` (it's UUID v4 — not time-sortable, which breaks our "most recent" indexes).

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

### 5.4 In-memory shapes (not persisted)

- **Round state during execution** — the live `Round` object is held in component state until settle, then committed to IndexedDB.
- **Selection state** — `Set<number>` of slot indices, transient until "Evolve" advances the round.
- **Theme state** — read once at mount, exposed via context, written to storage on toggle.

---

## 6. Provider integration (deep dive)

### 6.1 OpenAI client — `src/lib/providers/openai.ts`

```ts
const OPENAI_BASE = "https://api.openai.com/v1";
const OPENAI_IMAGE_MODEL = "gpt-image-2"; // OPEN QUESTION §14.A — confirm at integration
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

- `testGenerate`: `POST /images/generations` with smallest-cost params.
- `generate`: `POST /images/generations` with full params, including `image[]` for round 2+ references (gpt-image-2 accepts reference images via the same endpoint with `image` field).
- Verify request shape against current OpenAI image-generation docs at integration time. Open question §14.A.

**Header parsing for tier detection** — same logic as wizard (`src/lib/providers/tiers.ts`). Round engine also reads headers on every successful generate response and updates the in-storage `ipm` if the detected value disagrees with what's stored (gentle drift catches tier upgrades).

**Reference image encoding.** gpt-image-2 accepts reference images as multipart form data or as base64. Lean: multipart for size efficiency. Round 2+ flow assembles a FormData with the prompt, size params, and N image parts.

### 6.2 Gemini client — `src/lib/providers/gemini.ts`

```ts
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1";
const GEMINI_IMAGE_MODEL = "gemini-3-pro-image"; // OPEN QUESTION §14.B
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
      const wait = norm.retryAfterSeconds != null
        ? norm.retryAfterSeconds * 1000
        : delay + Math.random() * 250;
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
- **Bundle**: keep the wizard route lazy-loaded so users with keys never download wizard code. (`next/dynamic` with `ssr: false` for the gate.)

### 9.3 Error boundaries

- Top-level `<RootErrorBoundary/>` in `app/layout.tsx`.
- Per-slice boundaries: `<WizardErrorBoundary/>`, `<RoundErrorBoundary/>`, `<HistoryErrorBoundary/>`. Each shows a minimal "something broke, here's the error, try refreshing" UI without losing the rest of the app.
- All caught errors logged to `console.error` (no remote logging — DD-001 forbids backend).

### 9.4 Logging

Plain `console.debug` / `console.warn` / `console.error`. No telemetry library. Per AGENTS.md "Console Output" section: structured, minimal — avoid spam in successful paths.

### 9.5 Browser support

Modern evergreen: Chrome ≥ 110, Firefox ≥ 110, Safari ≥ 16, Edge ≥ 110. We use IndexedDB v3, fetch, AbortController, BigInt, structuredClone — all baseline in those versions.

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
- Storage usage estimate (`navigator.storage.estimate()`).
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

**New Session button.** Once the current session has at least one settled round, a "New Session" button appears in `<PromptArea/>` (next to "Generate"). Clicking it: confirm-if-unsettled → starts a fresh `Session` record on next Generate. Replaces the ambiguous "type a new prompt → ???" flow. Resolves §14.N.

**Image cache and object URLs.** `src/lib/round/image-cache.ts` exports a singleton `ImageCache` that owns `URL.createObjectURL` lifecycle. Components request `cache.get(roundId, slotKey)` to get a stable object URL for an image; the cache lazily creates Blob+URL from the round's `bytes` on first access and `revokeObjectURL`s when the consumer unmounts (refcounted) or when the cache is evicted via LRU (max ~64 active URLs). Prevents the leak when users scroll the history rail extensively. Thumbnails (§5.3) get the same cache treatment via a sibling `ThumbnailCache`.

Acceptance:
- 16 calls fan out, throttled per `concurrencyCap`.
- Cards stream in (no batched render).
- Live progress banner updates as cards arrive.
- Refresh during round → IndexedDB has placeholder; UI shows that round as terminated; user can regenerate failed slots via DD-019 mechanism.
- "New Session" button visible once ≥1 round settled in the current session.

### 10.5 FR-3 — Round 2+ evolution

`startRoundN(session, selectedRoundId, selections, commentary)`:

1. **Prepare references once, share across all parallel calls.** `prepareReferences(round, selections)`:
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

`<ModelToggle/>` is a controlled component owned by `<PromptArea/>`. **The full prompt-form state (model toggle + aspect picker + image-count picker + prompt textarea) lives in a `useRoundForm()` custom hook inside `<PromptArea/>`** — `useReducer` over a `RoundFormState` slice. Avoids prop-drilling these tightly coupled controls and avoids polluting `<RoundProvider/>` with form state that doesn't matter to anyone else.

When the user clicks "Generate", `<PromptArea/>` calls `roundProvider.startRound(formState.snapshot())` — passing a snapshot, not subscribing. `<RoundProvider/>` only sees the form values at the moment of dispatch.

Persistence across rounds within a session: kept in `<PromptArea/>` memory only. Resets when "New Session" is clicked. Resolves §14.J.

Toggling Gemini changes the aspect picker form (DD-023). Both controls live in `useRoundForm`, so the change is local and instant.

Edge: user disables both → Generate button disabled with tooltip *"Enable at least one provider."*

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
- Selection persists into the round record on advance.
- Visible "Selected: 2/4" counter beneath the grid.

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
- [ ] Install missing shadcn primitives: `alert`, `radio-group`, `select`, `separator`, `tooltip`, `progress`, `scroll-area`, `sonner`. (`bunx shadcn@latest add ...`)
- [ ] Add runtime deps via bun: `ulid`, `idb`, `msw` (verify React 19 / Next 16 compatibility for the test stack).
- [ ] Confirm OpenAI image model identifier (§14.A).
- [ ] Confirm Gemini image model + endpoint version (§14.B).

### Phase 1 — Foundations (storage + types)

Output: types and storage utilities with full unit-test coverage. Nothing user-visible yet.

1. `src/lib/providers/types.ts` — Provider, Tier, ProviderConfig, AspectRatioConfig, etc.
2. `src/lib/providers/errors.ts` — NormalizedError, ErrorKind.
3. `src/lib/storage/schema.ts` — VucibleStorageV1 + IndexedDB schemas + `generateId()` ULID helper.
4. `src/lib/storage/keys.ts` — read/write/clear with the §5.1 aspect invariant enforced at write time.
5. `src/lib/storage/wizard-progress.ts`, `history.ts`, `purge.ts`.
6. Tests: storage round-trips, schema rejection, aspect invariant enforcement on write.

Estimate: 2.5 hr (added ULID + invariant enforcement).

### Phase 2 — Provider clients (OpenAI + Gemini wrappers)

Output: `testGenerate`, `listModels`, `generate` functions for both providers, with mocked unit tests + a manual smoke-test script.

1. `src/lib/providers/tiers.ts`.
2. `src/lib/providers/openai.ts` — testGenerate + generate (basic, no references yet).
3. `src/lib/providers/gemini.ts` — listModels + generate (basic).
4. `src/lib/providers/openai.ts` — generate with reference images (multipart).
5. `src/lib/providers/gemini.ts` — generate with reference images (inline parts).
6. **Manual smoke test** (`scripts/smoke.ts`): run with real keys, verify endpoints, header shapes, and error paths. Resolves §14.A and §14.B.
7. Unit tests with msw.

Estimate: 4 hr.

### Phase 3 — Setup wizard (FR-8)

Output: a working wizard you can complete end-to-end with real keys. App is "alive" but only renders the wizard.

Detailed sub-phases in `docs/plans/wizard.md` §12.

Estimate: ~8 hr (per the wizard plan minus Phase 1 which is now done).

### Phase 4 — App shell + theme

Output: `<AppShell/>` renders after wizard, with TopBar, theme toggle, and a "Main app coming soon" placeholder. Theme persists across reloads.

1. `src/components/shell/AppShell.tsx`.
2. `<TopBar/>` with logo, history toggle (stub), theme toggle, settings gear (stub).
3. `<ThemeProvider/>` + `<ThemeToggle/>` with no-flash script.
4. Replace the wizard-slice `<MainAppPlaceholder/>` with `<AppShell/>`.

Estimate: 2 hr.

### Phase 5 — Settings page (FR-9)

Output: Settings dialog functional with auto-save-on-blur. Re-test, clear keys, change defaults, change concurrency cap, clear history.

1. `<SettingsDialog/>` shell with sections (auto-save pattern; no save button).
2. KeysPanel — reuses ProviderCard, adds Clear button.
3. DefaultsPanel — reuses pickers from wizard; each control writes to storage on blur/select.
4. ConcurrencyPanel — numeric inputs + hard cap + block-with-explainer.
5. HistoryPanel — storage estimate + Clear history.
6. Auto-save round-trip tests (write fails → field reverts + toast).

Estimate: 3.5 hr (auto-save is simpler than save-button + dirty tracking).

### Phase 6 — Round 1 generation (FR-2 + FR-4 + FR-11 + FR-5 grid render)

Output: type prompt → click Generate → 16 cards stream in with live progress banner. "New Session" button visible after first round. No selection wiring yet, no round 2.

1. `src/lib/round/throttle.ts` + `retry.ts` + `failures.ts` + `orchestrate.ts` + `image-cache.ts`.
2. `<RoundProvider/>` with a single in-progress round; exposes `{done, total, queued}` derived state.
3. `useRoundForm()` hook + `<PromptArea/>` (prompt + ModelToggle + AspectRatioPicker + ImageCountPicker + Generate + New Session button).
4. `<ResultGrid/>` with global progress banner + `<ImageCard/>` (loading + success + error states).
5. Eager intent persistence on round start; thumbnail generation + batched persistence on settle.
6. `ImageCache` wired into `<ImageCardSuccess/>` for object-URL lifecycle.

Estimate: 9 hr (added image cache, progress banner, new-session button, eager persistence wiring).

### Phase 7 — Selection + commentary + round 2+ (FR-3 + FR-5 selection)

Output: pick favorites, type commentary, click Evolve → round 2 generates with reference images.

1. `<SelectionOverlay/>` + selection state (typed as `{provider, index}[]`).
2. `<CommentaryInput/>`.
3. `src/lib/round/prompt.ts` — DD-015 template builder (round-2 vs round-N templates).
4. `prepareReferences()` helper (§10.5) — single-encode-share-many for OpenAI Blobs and Gemini base64.
5. Round 2+ orchestrator with prompt history; reuses the eager-intent + batched-settle persistence pattern.

Estimate: 6 hr.

### Phase 8 — History (FR-6)

Output: history rail with current-session rounds + cross-session list. Read-only on past rounds. Renders thumbnails only — never holds full bytes for non-active rounds.

1. `<HistoryRail/>` + `<RoundCard/>` mini-thumbs (rendered from `Round.results[*].thumbnail`).
2. `ThumbnailCache` (sibling of `ImageCache` from Phase 6, same lifecycle pattern).
3. Cross-session list.
4. `<ScrollBackPanel/>` read-only view (loads full bytes only for the visible round; releases on scroll-away).

Estimate: 4 hr.

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

Estimate: 4 hr.

### Phase 12 — Deploy (FR — DD-020)

1. Verify `next.config.ts` has `output: 'export'`.
2. Connect repo to Vercel; configure project; first deploy.
3. Set up custom domain (optional v1).
4. Smoke-test the deployed build with real keys.

Estimate: 2 hr.

### Total estimate

~50 hours of focused work for a v1. Realistic calendar time depends on availability, but this is the scoped surface.

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

### A. OpenAI image model identifier (§6.1)

Confirm `gpt-image-2` vs. `gpt-image-1.5` vs. another. Resolved by Phase 2 smoke test.

### B. Gemini image model + endpoint version (§6.2)

Confirm exact model string and `v1` vs `v1beta`. Resolved by Phase 2 smoke test.

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

### H. IndexedDB image format

ArrayBuffer + MIME (preferred) vs. Blob directly. Lean: ArrayBuffer + MIME — slightly smaller, more flexible. Display via `URL.createObjectURL(new Blob([buffer], {type: mime}))` lazily; `ImageCache` (§10.4) owns the lifecycle.

### I. Round 2+ reference image storage location

Already in IndexedDB from round 1. Round 2+ engine reads them directly. No separate cache.

### ~~J. Model toggle persistence across rounds in a session~~ — RESOLVED

Locked (§10.6): persists in `<PromptArea/>` memory across rounds within a session; resets when "New Session" is clicked. New session is an explicit button (§N also resolved).

### K. Aspect ratio carry-forward across rounds

Lean: carry by default; user can override per round.

### L. Selection clear behavior on Evolve

Lean: selection persists into the prior round's `Round.selections` (read-only audit trail in history); the new round's grid starts with no selection.

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

1. A new user with no keys completes the wizard, lands on the main app, types a prompt, clicks Generate, and receives 16 streaming images split across both providers.
2. Selecting 1–4 favorites + optional commentary + clicking Evolve produces a round 2 that demonstrably uses the references (visible visual continuity in most cases).
3. At least 5 rounds in a single session — history rail shows all of them; refresh preserves history.
4. Failure paths: bad key → useful error; rate limit → banner with upgrade nudge; content policy hit → tile + Regenerate; provider down → tiles + recovery via toggle-off.
5. Settings: change concurrency cap, change default image count, change default aspect, clear history, clear keys → all behave as specified.
6. Theme toggle persists across reloads with no flash.
7. `bun run build` produces a clean static export. Vercel deploy succeeds. Real-key smoke test on the deployed URL passes the happy path.
8. Lighthouse desktop scores: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 80.

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

---

## 18. Review notes for round 2

Per the planning-workflow methodology, this is a **round-1 draft**. Recommended next steps:

1. **Self-review pass** (Claude reading own work) — surface internal contradictions, missing dependencies, undersized risk items.
2. **GPT-Pro Extended Reasoning review** with the skill's exact review prompt — catches gaps the author missed; revisions integrated via the skill's exact integrate-revisions prompt.
3. **Optional multi-model blend** — Gemini Deep Think + Grok Heavy + Opus 4.5 for adversarial coverage. GPT-Pro as final arbiter.
4. **Convert to Beads** via `beads-workflow` once steady-state — each Phase task becomes a bead, with dependencies between phases preserved.
5. **Polish beads** through 6+ rounds.

After polish: implementation begins with a fan-out across phase-1 dependencies.
