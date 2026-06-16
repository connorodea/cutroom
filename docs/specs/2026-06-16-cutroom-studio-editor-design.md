# Cutroom — Studio Editor design spec

**Date:** 2026-06-16
**Status:** Approved — in build
**Source:** "Direction 1 — Studio" from the `ai-video-editing-platform-concept` handoff (Claude Design)

## Summary

Cutroom is an AI-native pro video editor. This spec covers the **Studio Editor** — a dark, dense,
cinematic timeline + color room (DaVinci / Final Cut DNA) with a ⌘K **AI Agent** that plans and runs
multi-step edits and lets the user apply or discard the result on a new timeline.

We are rebuilding the prototype as a **real product foundation**: pixel-faithful to the handoff, but
with real component/state boundaries, routing, and the agent wired to the live Claude API — architected
so real video + real editing operations can drop in next.

## Decisions

- **Stack:** pnpm workspaces · Vite + React 19 + TypeScript (strict). Mirrors the `geostamp` house pattern.
- **State:** a single typed **Zustand** store (`editorStore`) — active page, selected clip, agent phase/steps.
- **Styling:** **CSS Modules** per component + a `tokens.css` of the exact palette. Real `:hover` replaces
  the prototype's `style-hover`. Icons via **lucide-react** (the set the prototype inlined).
- **Agent transport:** the server forces Claude to call a `propose_edit_plan` tool whose JSON schema mirrors
  the handoff's steps. The client plays the *real* returned plan back with the designed cadence
  (~760ms/step, spinner → check, progress bar, Apply / Discard). Plan content is real; UI is pixel-identical.
- **Server:** **Hono** on Node, written Workers-portable. One route `POST /api/agent/plan`. Anthropic SDK with
  forced tool use + **prompt caching** on the system prompt. Model `claude-sonnet-4-6` (env-overridable to
  `claude-opus-4-8`). Key from `ANTHROPIC_API_KEY` — server-side only, never shipped to the client.
- **Home:** new standalone repo `connorodea/cutroom`; tracked in the **Cutroom** Todoist project. A Preecursor app.
- **Brand:** a subtle "Cutroom" wordmark in the topbar; the sample project stays "Northwind / Episode 04"
  so the screen matches the mock.

## Architecture

```
apps/
  web/      Vite + React + TS — the editor
  server/   Hono (Node) — POST /api/agent/plan -> Anthropic
packages/
  core/     pure TS — domain types, sample project, agent plan schema (shared web <-> server)
```

### `packages/core` (no React)

Domain types (`MediaClip`, `Bin`, `Track`, `TimelineClip`, `Slider`, `ColorWheel`, `RenderPreset`,
`RenderJob`, `Project`, `PageId`), the agent plan **zod** schema (`agentPlanSchema`, reused by server to
validate model output and by the client to type the response), `baseEditSteps` + `agentWorkflows`, the
deterministic `generateWaveform`, and `sampleProject` — the exact prototype data so screens render identically.

### `apps/web`

- `EditorShell` — topbar (Cutroom mark · Northwind/Ep04 · tab group · Ask Agent ⌘K · avatars · Render) →
  page router → left tool rail. Global ⌘K / Esc key hook.
- `editor/pages/` — `MediaPage`, `CutPage`, `EditPage`, `ColorPage` (the page the file opened on), `DeliverPage`.
- `editor/components/` — `TopBar`, `ToolRail`, `MediaPool`, `Viewer`, `TransportBar`, `Timeline`
  (`Ruler` / `Lane` / `Clip` / `Playhead`), `ColorWheel`, `SliderRow`, `WaveBars`, `Thumb`, `Tag`, `Icon`.
  Each isolated and props-driven.
- `agent/` — `AgentPalette` overlay (glass blur; idle composer + 4 workflow presets; running/done states),
  `useAgentRun` (phase machine + playback cadence), `agentClient.ts` (fetch `/api/agent/plan`).
- `app/tokens.css` — the exact palette, surface ramp, text ramp, accent, IBM Plex Mono numerics.

### `apps/server`

`POST /api/agent/plan` `{ prompt, context }` → Anthropic Messages API, forced `propose_edit_plan` tool,
prompt caching on the system prompt, returns a validated `AgentPlan`. Falls back to `baseEditSteps` on error
so the UI never dead-ends. Vite dev-proxies `/api` → server.

## Data flow

1. User opens ⌘K → `AgentPalette`. Picks a preset or types a prompt.
2. `agentClient` POSTs to `/api/agent/plan`. Server calls Claude → structured `AgentPlan` → validated → returned.
3. `useAgentRun` reveals steps with the designed cadence; `editorStore` holds phase (`idle`→`running`→`done`).
4. Done state offers **Apply to timeline** / **Discard** (reversible) — both mocked in this build.

## Error handling

- Server unreachable / model error → client uses `baseEditSteps` and still animates (graceful degrade).
- Model returns invalid shape → zod parse fails server-side → server returns the base pipeline, logs the error.
- Missing `ANTHROPIC_API_KEY` → server boots but `/api/agent/plan` returns the simulated plan with a header flag.

## Testing

Vitest (matches geostamp). `core`: plan-schema validation + sample-data integrity (done). `web`: each page
mounts; agent phase machine transitions `idle → running → done`. `server`: route returns a schema-valid plan,
and falls back on a forced error.

## Out of scope (next specs)

Real media import / playback, real edit operations, auth, persistence, collaboration, render backend. The
agent's edits stay mocked; only the *plan* is real.
