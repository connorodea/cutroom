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
      ],
      reporter: ["text-summary", "text"],
    },
  },
});
