# Cutroom

**AI-native pro video editor.** A dark, dense, cinematic timeline + color room — DaVinci / Final Cut DNA — with a ⌘K **AI Agent** that plans and runs multi-step edits (cut silences → reframe 9:16 → caption → color-match → score) and lets you apply or discard the result on a new timeline. A [Preecursor](https://preecursor.com) app.

This is the **Studio** direction from the original concept handoff, rebuilt as a real product foundation.

## Monorepo

```
apps/
  web/      Vite + React + TS — the editor UI (Media / Cut / Edit / Color / Deliver + ⌘K agent)
  server/   Hono (Node) — POST /api/agent/plan -> Anthropic Messages API (structured plan)
packages/
  core/     Pure TS — domain types, sample project, agent plan schema (shared web <-> server)
```

## Stack

- **pnpm** workspaces, **TypeScript** strict everywhere
- **Vite + React 19** for the editor
- **Zustand** for editor state, **CSS Modules + token stylesheet** for pixel-faithful styling
- **lucide-react** icons (same set the prototype inlined)
- **Hono** agent server calling the **Anthropic SDK** with forced tool use + prompt caching
- **Vitest** for tests

## Develop

```bash
pnpm install
cp .env.example .env   # then set ANTHROPIC_API_KEY
pnpm dev               # editor (web)
pnpm dev:server        # agent server
pnpm typecheck
pnpm test
```

## Status

Foundation in place: monorepo + shared `@cutroom/core` domain. Editor UI, agent palette, and server are being built page-by-page — see the Cutroom Todoist project for the live queue.

## Design

See [`docs/specs/2026-06-16-cutroom-studio-editor-design.md`](docs/specs/2026-06-16-cutroom-studio-editor-design.md).
