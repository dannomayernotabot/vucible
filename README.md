# vucible — Visualization Crucible

Browser-only image-prompt evolution tool. BYOK (Bring Your Own Key) — no backend, no proxy, no telemetry.

## What it does

- **Generate**: paste your OpenAI / Gemini API keys, type a prompt, get a grid of AI-generated images.
- **Evolve**: pick your favorites from each round, add commentary ("more red", "less busy"), and iterate — each round feeds selected images + feedback back into the next generation.
- **Own your data**: keys live in `localStorage`, images in `IndexedDB`. Nothing leaves the browser except direct API calls to OpenAI / Gemini.

## BYOK security model

Vucible never proxies API calls through a server. Your keys are stored in the browser's `localStorage` under the key `vucible:v1` and sent directly to provider endpoints via `fetch()`. This means:

- Keys are only as safe as your browser profile. Anyone with access to your machine can read `localStorage`.
- Clear keys via **Settings → Keys → Clear storage** or by clearing browser site data.
- Cross-tab isolation: a `storage` event listener notifies other tabs when keys change.
- The app runs as a static export (`output: "export"`) — there is no Next.js server at runtime.

## Run locally

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The setup wizard walks you through pasting API keys and choosing defaults.

**Do not use `npm`, `yarn`, or `pnpm`** — this project uses `bun` exclusively (see AGENTS.md).

## Run tests

```bash
bun run test          # 769 tests (vitest + jsdom + fake-indexeddb)
bun run test -- --ui  # vitest UI mode
```

Tests cover unit, integration, and full-flow E2E (wizard → round 1 → select → round 2 → settings → clear history) with mocked provider APIs.

## Build

```bash
bun run build         # static export to out/
```

The build produces a fully static site (no server-side rendering) suitable for any static hosting.

## Deploy

The app is configured for static export (`next.config.ts: output: "export"`). Deploy the `out/` directory to any static host:

- **Vercel**: connect the GitHub repo; Vercel auto-detects Next.js static export.
- **Any CDN/host**: upload the contents of `out/` after `bun run build`.

## Key rotation

1. **OpenAI**: revoke at [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → in vucible Settings → Clear storage → re-run wizard → paste new key → Validate.
2. **Gemini**: revoke at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → same flow.
3. Other tabs are notified via `storage` event and will show the cleared state.

## Where data lives

| Store | Key / Name | Contents |
|-------|-----------|----------|
| `localStorage` | `vucible:v1` | API keys, tier info, defaults (image count, aspect ratio, theme) |
| `IndexedDB` | `vucible-history` | Sessions, rounds, image bytes, thumbnails |

Both are wiped via **Settings → History → Clear all history** (IDB) and **Settings → Keys → Clear storage** (localStorage).

## Architecture

```
src/
├── app/                    # Next.js App Router (page + layout)
├── components/
│   ├── wizard/             # Setup wizard (4-step key validation flow)
│   ├── shell/              # AppShell, TopBar, ThemeProvider
│   ├── round/              # RoundProvider, PromptArea, CommentaryInput
│   ├── grid/               # ResultGrid, ImageCard*, SelectionOverlay, ImageZoom
│   ├── history/            # HistoryRail, RoundCard, ScrollBackPanel
│   ├── settings/           # SettingsDialog (Keys, Defaults, Concurrency, History)
│   ├── feedback/           # Error boundaries, RateLimitBanner
│   └── ui/                 # shadcn/ui primitives
└── lib/
    ├── providers/          # OpenAI + Gemini API clients (generate, testGenerate)
    ├── round/              # Orchestrate, fanOut, throttle, image-cache, retry
    ├── storage/            # localStorage (keys.ts), IndexedDB (history.ts), purge
    └── wizard/             # Wizard state machine
```
