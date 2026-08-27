import js from "@eslint/js";
import globals from "globals";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

/**
 * The lint gate.
 *
 * Phase 1 retired the plain HTML/CSS/JS build, so the "two apps at once" shape
 * this file used to have is gone: everything under `src/` and `e2e/` is now
 * TypeScript, and `tsc` rather than `no-undef` is what catches a name that does
 * not exist. The one remaining JavaScript file is this config's own sibling,
 * `vitest.config.js`.
 *
 * Order matters. ESLint applies configs in sequence and later ones win for
 * matching files, so the plain-JS block is scoped to its own file patterns, the
 * Next configs come after, and the house-rule block after those - it has to win
 * over `eslint-config-next`'s `warn`-level `no-unused-vars`, not merge with it.
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
  // The remaining plain JavaScript: config files that run in Node.
  // ---------------------------------------------------------------------

  {
    files: ["*.config.js"],
    ...js.configs.recommended,
  },

  {
    files: ["*.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
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

  // ---------------------------------------------------------------------
  // The Next app, the engine, and the E2E suite - all TypeScript.
  // ---------------------------------------------------------------------

  ...nextVitals,
  ...nextTs,

  {
    // E2E specs straddle two runtimes: the spec body runs in Node, but a
    // callback handed to `page.evaluate` is serialised and runs inside the
    // page, so both sets of globals are legitimately in scope in one file.
    files: ["e2e/**/*.ts"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  /**
   * The house rules, re-asserted over the TypeScript the app is actually made
   * of.
   *
   * Phase 1 narrowed the plain-JS block above to `*.config.js`, which was right
   * for `js.configs.recommended` - `tsc` subsumes `no-undef` - and wrong for
   * these three, because nothing else in the chain supplies them:
   *
   *   - `eqeqeq` is not a type error. `tsc` permits `==` between compatible
   *     types and `eslint-config-next` does not enable the rule, so loose
   *     equality was silently unflagged across `src/` and `e2e/`. In a repo
   *     whose whole product is arithmetic that has to be exactly right, that is
   *     the wrong rule to lose.
   *   - `@typescript-eslint/no-unused-vars` ships from the Next config at
   *     `warn`, and `npm run lint` had no `--max-warnings`, so it could not
   *     fail a build. It is an error here; `--max-warnings 0` in package.json
   *     closes the other half.
   *   - `reportUnusedDisableDirectives` is a linterOptions setting, not a rule,
   *     so it does not inherit from any preset at all. A stale disable comment
   *     is a rule that stopped applying and a comment that now lies.
   *
   * Found by probing rather than by reading: no line of the diff that removed
   * them said so. See Docs/code-review-2026-08-27.md, finding 2.
   */
  {
    files: ["src/**/*.{ts,tsx}", "e2e/**/*.ts"],
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      eqeqeq: ["error", "always", { null: "ignore" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },

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
