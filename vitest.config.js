import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // AGENTS.md requires `@/` over deep relative imports, and tsconfig.json's
  // `paths` only teaches that to the compiler and to Next's bundler. Vitest
  // runs neither, so the same alias is spelled out here. Done by hand rather
  // than with `vite-tsconfig-paths`: this app is meant to reach 1.0 with
  // approximately zero dependencies, and one line beats a package.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },

  test: {
    // Node, globally, on purpose. Most of what is worth testing here is the
    // pure half - engine, parse, format - which has no DOM and should not pay
    // for one. The handful of files that do need a document opt in with a
    // `// @vitest-environment jsdom` pragma at the top, per AGENTS.md.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],

    // The timezone is pinned for the same reason playwright.config.ts pins the
    // browser's. `src/lib/clock.ts` reads LOCAL wall-clock fields - that is the
    // whole reason this app needs no timezone plumbing - and a suite running in
    // whatever zone the machine happens to be in cannot assert anything about a
    // DST transition, because a UTC runner has none. America/New_York is a zone
    // that actually has one.
    //
    // A property of the HARNESS, not of the app: nothing under `src/` reads a
    // timezone. These tests only need local and UTC to genuinely disagree.
    env: { TZ: "America/New_York" },
  },
});
