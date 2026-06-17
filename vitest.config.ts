import { defineConfig } from "vitest/config";

/**
 * Root config for workspace-wide options. Projects are defined in vitest.workspace.ts
 * (each package/app, so apps/web runs in jsdom via its own vite.config and the rest in node).
 * This file only supplies coverage settings for `vitest run --coverage`.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      all: true,
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "**/dist/**",
        "**/node_modules/**",
        "**/.claude/**",
        "**/test/**", // test harness/setup
        "**/types.ts", // type-only, no runtime
        "**/*.config.{ts,js}",
        "**/vite-env.d.ts",
        "apps/web/src/main.tsx", // DOM bootstrap (mount only)
        "apps/worker/smoke-*.ts", // manual smoke scripts
        "apps/*/scripts/**",

        // --- I/O glue & process bootstraps: not unit-testable without brittle subprocess/
        // network mocks. Verified by the live integration tests run on each deploy. The PURE
        // helpers these files build on (cut-planner, overlay/reframe filter builders, higgsfield
        // request/response shaping, pexels search) ARE unit-tested in their own *.test.ts. ---
        "apps/worker/src/index.ts", // Hono worker server + multipart routes (live-tested)
        "apps/worker/src/jobs.ts", // async job factories wrapping the ffmpeg/network pipelines
        "apps/worker/src/create.ts", // Create pipeline: TTS + Pexels + ffmpeg + Whisper orchestration
        "apps/worker/src/ffmpeg.ts", // thin child_process ffmpeg/ffprobe wrappers
        "apps/worker/src/script.ts", // OpenAI chat client (writeScript / suggestOverlays)
        "apps/worker/src/tts.ts", // OpenAI TTS client
        "apps/worker/src/transcribe.ts", // OpenAI Whisper client
        "apps/server/src/index.ts", // Hono agent server bootstrap
        "apps/cli/src/index.ts", // CLI argv bootstrap (runs main() on import; commands are network-only)
        "apps/mcp/src/index.ts", // MCP stdio server bootstrap
      ],
      reporter: ["text-summary", "text"],
    },
  },
});
