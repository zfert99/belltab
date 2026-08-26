import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node, globally, on purpose. Most of what is worth testing here is the
    // pure half - engine, parse, format - which has no DOM and should not pay
    // for one. The handful of files that do need a document opt in with a
    // `// @vitest-environment jsdom` pragma at the top, per AGENTS.md.
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
