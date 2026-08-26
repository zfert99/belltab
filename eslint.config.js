import js from "@eslint/js";
import globals from "globals";

/**
 * The lint gate.
 *
 * This repo has no compiler. Nothing checks that a name exists before the
 * browser reaches it at runtime, so `no-undef` is doing the job a type checker
 * would do elsewhere - it is the reason ESLint is here at all, not style.
 *
 * `eslint-plugin-jsx-a11y` is required by AGENTS.md and is deliberately absent:
 * there is no JSX in this build. It arrives with the Next port. See Open gaps
 * in `Docs/build-log.md`.
 */
export default [
  {
    ignores: [
      "node_modules/",
      "coverage/",
      "test-results/",
      "playwright-report/",
      ".vercel/",
      ".next/",
      "out/",
    ],
  },

  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    linterOptions: {
      // An unused disable comment is a rule that stopped applying and a comment
      // that now lies about the code. Fail on it rather than let it rot.
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      // Argument-position underscores are the escape hatch for a signature that
      // must keep a parameter it does not read.
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",
    },
  },

  {
    // The app itself: a browser and nothing else. No `process`, no `require` -
    // if one appears here it is a mistake, and `no-undef` will say so.
    files: ["src/**/*.js"],
    languageOptions: { globals: globals.browser },
  },

  {
    // Unit tests live under `src/` by the colocation rule, but they run in
    // Vitest, not in a page: the jsdom suite reads the real index.html off disk
    // through `node:fs`, so it needs Node's globals as well as the browser's.
    files: ["src/**/*.test.js"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },

  {
    // Tooling that runs under Node: the dev server and the two configs.
    files: ["scripts/**/*.js", "*.config.js"],
    languageOptions: { globals: globals.node },
  },

  {
    // E2E specs straddle both: the spec body runs in Node, but the callbacks
    // handed to `page.evaluate` are serialised and run inside the page.
    files: ["e2e/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
