import js from "@eslint/js";
import globals from "globals";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

/**
 * The lint gate, spanning two apps at once.
 *
 * This repo currently holds both the plain HTML/CSS/JS build (`src/*.js`,
 * `src/ui/`, `src/lib/`) and the Next scaffold (`src/app/**.tsx`), and they
 * need different treatment: the plain half has no compiler, so `no-undef` is
 * standing in for a type checker, while the TypeScript half gets that from
 * `tsc` and needs React and accessibility rules instead.
 *
 * Order matters. ESLint applies configs in sequence and later ones win for
 * matching files, so the plain-JS block is scoped to its own file patterns and
 * the Next configs come after.
 *
 * Version ceilings worth knowing before upgrading anything here:
 *   - `eslint-plugin-jsx-a11y` has no ESLint 10 support at any version, which
 *     is why ESLint is pinned to 9.
 *   - `typescript-eslint` throws on TypeScript 7, which is why TypeScript is
 *     pinned to 6.0.3. Tracked at typescript-eslint#10940.
 */
const config = [
  {
    ignores: [
      "node_modules/",
      "coverage/",
      "test-results/",
      "playwright-report/",
      ".vercel/",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },

  // ---------------------------------------------------------------------
  // The plain build. Scoped by `files` so none of it leaks onto the TSX.
  // ---------------------------------------------------------------------

  {
    files: ["src/**/*.js", "e2e/**/*.js", "scripts/**/*.js", "*.config.js"],
    ...js.configs.recommended,
  },

  {
    files: ["src/**/*.js", "e2e/**/*.js", "scripts/**/*.js", "*.config.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    linterOptions: {
      // An unused disable comment is a rule that stopped applying and a comment
      // that now lies about the code.
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",
    },
  },

  {
    // The app itself: a browser and nothing else.
    files: ["src/**/*.js"],
    languageOptions: { globals: globals.browser },
  },

  {
    // Unit tests live under `src/` by the colocation rule but run in Vitest:
    // the jsdom suite reads the real index.html off disk through `node:fs`.
    files: ["src/**/*.test.js"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },

  {
    files: ["scripts/**/*.js", "*.config.js"],
    languageOptions: { globals: globals.node },
  },

  {
    // E2E specs straddle both: the spec body runs in Node, but a callback
    // handed to `page.evaluate` is serialised and runs inside the page.
    files: ["e2e/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  // ---------------------------------------------------------------------
  // The Next app.
  // ---------------------------------------------------------------------

  ...nextVitals,
  ...nextTs,

  /**
   * The full accessibility rule set, on top of the Next config.
   *
   * This is not redundant. `eslint-config-next` bundles jsx-a11y but enables
   * only 6 of its 32 recommended rules, and the 26 it leaves off include
   * exactly the ones this app's editor depends on -
   * `label-has-associated-control`, `click-events-have-key-events`,
   * `interactive-supports-focus`, `no-static-element-interactions`,
   * `no-noninteractive-tabindex`. AGENTS.md requires `recommended` and calls it
   * a blocking check; taking the Next default would have been a green tick over
   * a fifth of the rules.
   *
   * Only the RULES are spread, never the whole flat config: `eslint-config-next`
   * has already registered the `jsx-a11y` plugin, and registering it twice is a
   * hard "Cannot redefine plugin" error rather than a merge.
   */
  {
    files: ["src/**/*.{jsx,tsx}"],
    rules: { ...jsxA11y.flatConfigs.recommended.rules },
  },
];

export default config;
