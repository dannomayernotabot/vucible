# vucible — Product Requirements

> **Visualization Crucible.** A tool for evolving a visual idea from a vague text description into a refined image through structured rounds of generation and selection.

Status: **Draft / MVP scoping**
Last updated: 2026-04-26

---

## 1. Problem

Existing image generation tools collapse into a "groove" once you start iterating in a single thread — outputs converge on a narrow visual neighborhood and lose diversity. Starting a new thread is the only escape, but then you lose the context of what you liked. There is no good tool for **prompt → 16 diverse options → pick favorites → evolve → repeat**, where each generation step gets a fresh, untainted context.

Reference: Emmett Shear, [@eshear, Mar 19 2026](https://twitter.com/eshear/status/...): *"What's the best framework for visual prompt evolution? I want to give a general direction... and have something generate 16 options, I pick 1-5 favorites w optional commentary, it reflects and evolves and tries again, rinse and repeat. The main image generation tools completely collapse for this use case, they immediately fall into a groove and can't get out."*

## 2. Target user

A designer, founder, or hobbyist iterating on a visual concept (logo, illustration, character design, mood board) who:

- Knows roughly what they want but not exactly
- Wants to explore the space of possibilities, not lock in a direction immediately
- Has their own OpenAI / Google API keys (or will get them)
- Is comfortable in a browser, not a desktop app

## 3. Core flow

1. User opens vucible, enters their **OpenAI** and/or **Google Gemini** API keys (stored in localStorage)
2. User types a general prompt: *"new logo for project X, see brief"*
3. User picks how many images per round (4, 8, or 16) and which models are active (OpenAI, Gemini, or both)
4. App fires N parallel image-gen calls — each in a fresh, isolated context — and streams results into a grid grouped by model
5. User picks **1–4 favorites** and optionally adds text commentary
6. App generates the next round using the selected images as direct references plus the original prompt and an "evolve" directive
7. Loop steps 4–6 until the user is satisfied
8. User downloads their final image

## 4. Functional requirements

### FR-1: API key management
- BYOK only. Keys are stored in browser `localStorage`.
- Keys are never sent to any server other than OpenAI / Google.
- App detects which models are usable based on which keys are present.
- Key entry / clearing / re-test surfaces are defined in **FR-8** (first-run wizard) and **FR-9** (settings page).

### FR-2: Round 1 — fresh generation
- User-supplied prompt is sent N times to each enabled model (no LLM-mediated rewriting in MVP).
- Image-count options: **4, 8, 16**. When two models are enabled, count is split evenly between them.
- Aspect ratio (per **FR-11** / **DD-023**) drives the API `size` parameter on each call; a redundant aspect hint is also appended to the prompt text.
- Calls are fired in parallel (subject to per-provider concurrency throttle, **DD-016**); results stream into the grid as they complete.
- Failure handling per **FR-10** / **DD-019**.

### FR-3: Round 2+ — evolution
- User selects 1–4 images and may add text commentary.
- Each new generation call receives the prompt template defined in **DD-015**: the original prompt + the full history of prior-round commentary + the K selected reference images from the most recent prior round + a single-line evolve directive.
- Same prompt verbatim across all parallel calls in a round (no per-call variation; trust model variance per DD-005 / DD-006).
- Aspect ratio (per **FR-11** / **DD-023**) carries forward by default but can be changed per round.
- Each call is independent (fresh context), but all share the same prompt and reference set for that round.
- Failure handling per **FR-10** / **DD-019**.

### FR-4: Model toggle
- Per-round toggle: use OpenAI only, Gemini only, or both.
- Toggle can be flipped between rounds.
- Toggling Gemini changes the form of the aspect-ratio picker per **FR-11** / **DD-023** (discrete-vs-freeform).

### FR-5: Grid display
- Two stacked sections grouped by model (OpenAI section, Gemini section).
- Each image labeled with model and round.
- Click to select / deselect (visual indicator); cap at 4 selected.
- Click-and-hold or expand-button to view full size.

### FR-6: History
- All rounds (prompts, generated images, selections, commentary) stored in IndexedDB.
- Linear history only — no branching, no undo, no jumping back to an earlier round in MVP.
- User can scroll back through earlier rounds in the same session.
- History persists across reloads of the same browser/profile.

### FR-7: Export
- User can download any individual image (right-click / explicit download button).
- No "export the journey" feature in MVP.

### FR-8: First-run setup wizard (see DD-017, DD-022)
- Required. Blocks the main UI until at least one provider key is entered and validated.
- Per-provider entry cards (OpenAI, Gemini) with "Get a key" link, paste field, and **test-connection on paste**:
  - **OpenAI paste**: small test image gen call (~$0.04, disclosed upfront before the paste field). Validates auth AND auto-detects tier from rate-limit headers; concurrency cap and IPM are surfaced immediately.
  - **Gemini paste**: free list-models call validates auth; user self-declares tier via a dropdown (Free / Tier 1 / Tier 2 / Tier 3).
- Loud warning on a detected/declared 0-IPM Gemini key (free tier post-Dec 2025): *"Free Gemini API tier doesn't include image generation. Add billing in AI Studio."*
- Multi-provider recommendation: encourages users to add both keys for output diversity.
- Light cost expectation note (~$0.04–0.08/image; 16-image round ≈ $0.64–1.28 across both).
- **Default image count selector** (4 / 8 / 16) at the end of the wizard, with the tier-bound IPM cap shown alongside.
- **Default aspect ratio selector** alongside image count; default 1:1; picker form follows FR-11 / DD-023 based on which providers were entered.
- No "skip for now" escape hatch.

### FR-9: Settings page (see DD-018)
- Accessible post-wizard. Mirrors wizard controls plus advanced.
- Default per-round image count (4 / 8 / 16) — sets starting per-round selection; per-round picker still wins per round.
- Default aspect ratio (per **FR-11** / **DD-023**) — sets starting per-round selection; per-round picker still wins per round.
- Per-provider concurrency caps (numeric, hard-capped at detected/declared tier max per **DD-016**; blocked beyond with explainer + upgrade link).
- Live tier info per provider: detected/declared tier, current IPM cap, link to upgrade docs.
- Key management: re-paste, clear, re-test per provider (re-test = same mechanic as wizard paste — small OpenAI test gen, free Gemini list-models).
- Provider doc links: keys page, pricing, rate limits.
- **Clear history** button: wipes all rounds across all sessions; non-reversible. (DD-021)
- Clearing all keys returns the app to wizard state.

### FR-10: Failure handling for parallel calls (see DD-019)
- Per-call retry up to 3x on retryable errors (429, 5xx, network / timeout). Non-retryable errors (400, 401 / 403, 422 content policy) fail immediately to terminal state.
- Backoff: honor `Retry-After` header on 429s; otherwise exponential with jitter (~1s, 2s, 4s).
- Retries respect the per-provider concurrency throttle (DD-016) — re-queued into the local queue, not bypassed.
- Terminal failures show error tiles with per-error-type messages (rate limit, auth failure, content blocked, server error, network) and a "Regenerate" button.
- Round selection is enabled once all slots reach terminal state (success or failed-after-3-retries).
- User selects 1–4 favorites from **successful** slots; failed slots are excluded from selection. User can advance without regenerating failed slots.

### FR-11: Aspect ratio control (see DD-023)
- Per-round control, colocated with the model toggle (FR-4) in the prompt area.
- **Gemini enabled (alone or alongside OpenAI)**: discrete picker showing the 10 Gemini-supported ratios (1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9) as visual rectangle buttons.
- **OpenAI only (Gemini toggled off)**: freeform `width × height` input. Discrete buttons available under a "Quick presets" toggle.
- Re-enabling Gemini after a freeform ratio: auto-snap to nearest supported ratio with inline note.
- Default in wizard / settings: **1:1 (square)**.
- The chosen ratio drives the API `size` parameter, a redundant aspect hint appended to prompt text, and the image card aspect in the grid (all 16 cards in a round share the chosen aspect — fixed N×M grid, no masonry).

## 5. Non-goals (MVP scope cuts)

These are explicitly **out of scope** for the first version:

- ❌ Branching off a previous round / undo / re-pick favorites from round N
- ❌ Animation-style pickers and other structured-input UI for parameters that fit in the prompt (aspect ratio *is* now a UI control per FR-11 / DD-023; everything else stays in the prompt)
- ❌ LLM-mediated prompt expansion / diversification ("write 16 varied sub-prompts" before generation)
- ❌ Cross-device sync (Supabase / cloud storage for history)
- ❌ Sharing / collaboration / public galleries
- ❌ Model routing intelligence (e.g., "use OpenAI for logos, Gemini for photos")
- ❌ Auth, accounts, payments
- ❌ Per-call or session cost computation / display (users monitor spend via their provider dashboards)
- ❌ Free-tier with hosted OSS image gen (see DD-014)
- ❌ Automatic history pruning / GC (see DD-021 — manual "Clear history" only)

## 6. Success criteria for MVP

- User can complete the full loop (prompt → 16 results → pick → evolve) end-to-end with their own API keys
- Round-to-round latency is dominated by image gen time, not app overhead
- A user iterating across 5+ rounds reports meaningfully different ending state than starting state (i.e., the "groove" is broken by selection-driven evolution)

## 7. Future considerations (post-MVP)

- Visual aspect-ratio slider with live frame preview
- Animation/style picker with example images
- LLM-mediated prompt diversification for round 1 (configurable)
- Branching history with named branches
- Supabase-backed cross-device sync
- Per-image regeneration ("give me another like this one")
- Round-level diff view ("what changed from round 3 to round 4?")
- Public sharing of evolution journeys
