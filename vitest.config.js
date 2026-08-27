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
  },
});
