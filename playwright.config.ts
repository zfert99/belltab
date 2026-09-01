import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end config.
 *
 * These tests exist for the things jsdom structurally cannot see: real layout
 * (the WCAG reflow gate is a measurement, not an assertion about markup), and
 * real browser lifecycle - a modal <dialog>'s Escape, which jsdom does not
 * implement at all.
 *
 * TypeScript rather than JavaScript since Phase 1: the app it drives is typed,
 * and `npm run typecheck` covers `**\/*.ts`, so the suite is compiled by the
 * same gate as the code under test.
 */

const PORT = 3111;

/**
 * `basePath: '/bell'` in next.config.ts means the app does not live at the
 * origin root: `/` is a 404 and every route and asset carries the prefix.
 *
 * It is NOT folded into `baseURL`, and that is deliberate. Playwright resolves
 * a relative navigation with `new URL(path, baseURL)`, so a baseURL ending in
 * `/bell` plus a `goto("/")` resolves back to the origin root and 404s. The
 * prefix belongs on the paths instead - see `openApp` in e2e/helpers.ts.
 */
export const BASE_PATH = "/bell";

export default defineConfig({
  // E2E lives in a top-level directory, exempt from the colocation rule that
  // governs unit tests. It is testing the assembled app, not any one module.
  testDir: "./e2e",
  fullyParallel: true,

  /**
   * Three, not Playwright's default of half the machine's cores.
   *
   * Measured rather than chosen, twice over.
   *
   * Phase 4 took the suite from 83 tests to 108, and at eight workers a full run
   * started failing intermittently - sometimes `browserContext.newPage: Target
   * crashed`, sometimes a boot wait timing out, never twice on the same test.
   * Eight browsers plus a `next start` exhaust the machine, and a crashed
   * renderer looks exactly like an app that will not hydrate. Raising the boot
   * timeout made it WORSE, which is the tell: a starved worker given longer
   * holds its slot longer.
   *
   * Adding WebKit and Firefox took the run to 366 tests across three engines and
   * moved the line again. At four workers the failures came back, concentrated
   * in the axe scan under WebKit - the heaviest thing in the suite, since axe
   * serialises the whole rendered document.
   *
   * Three looked clean and was not. Over six full runs it produced three clean
   * ones, then a single failure, then four - always the boot wait, never the
   * same test twice, which is this machine's signature for a starved worker
   * rather than a broken app. An intermittently red suite is worse than a slow
   * one, because the first thing it costs is the habit of believing it. Two is
   * clean over repeated runs at 2.5 minutes against three's 1.9, and that
   * thirty seconds buys a result you can act on.
   *
   * CI keeps the default. Its runners have fewer cores and therefore already get
   * fewer workers, and pinning a number here would raise it on a 2-core box.
   */
  workers: process.env.CI ? undefined : 2,

  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // "github" annotates the failing line in the PR diff but writes nothing to
  // disk. Pairing it with the html reporter is what makes the workflow's
  // upload-artifact step able to hand back a trace - without it the first red
  // run produced "No files were found with the provided path".
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",

    // Pinned so a fixed instant means the same wall-clock time on every
    // machine. This is a property of the TEST HARNESS, not of the app - the
    // app deliberately has no timezone plumbing and reads local wall-clock
    // minutes, which is exactly what this makes reproducible.
    timezoneId: "America/New_York",

    /**
     * Pinned for the same reason, and it controls one thing only: the shape of
     * the NATIVE date and time controls.
     *
     * A `<input type="time">` renders a 12-hour control with an AM/PM segment
     * under `en-US` and a 24-hour control without one under `en-GB`, which
     * changes what typing into it with the keyboard means. Under `en-US` the
     * keystrokes are `0300PM`; the CI runner's WebKit rejected them while
     * Chrome and Firefox accepted them, and the test was measuring a control's
     * meridiem handling rather than anything about this app.
     *
     * Safe to pin because the app formats every time it displays ITSELF, by
     * integer arithmetic in `format.ts` - there is no `Intl` and no
     * `toLocaleString` anywhere in `src/`, which is a project rule and not a
     * coincidence. So this moves the browser's controls and moves nothing the
     * app renders.
     */
    locale: "en-GB",
  },

  /**
   * Three engines, which `AGENTS.md` has asked for from the start.
   *
   * "Playwright, not Cypress for E2E - real WebKit coverage and free
   * parallelization" was the reason this repo chose Playwright, and for the
   * first four phases it ran one engine anyway. WebKit is where the things this
   * app leans on differ most: `<dialog>`, `:modal`, `inert`, the throttling
   * thresholds the countdown is designed around, and the native date and time
   * inputs the editor and the calendar are built out of - each of which Safari
   * renders at a different intrinsic width, which is a reflow-gate input.
   */
  projects: [
    {
      // The Chrome already on the machine, via `channel`, rather than a
      // downloaded Chromium: it is the engine the original review measured in,
      // and it costs no browser binary.
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      // Playwright's WebKit build, not Safari itself. It is the same engine and
      // it is what CI can run; a real Safari tab, backgrounded for real
      // minutes, is a different claim and is still an open gap.
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],

  webServer: {
    /**
     * A production build, not `next dev`, and not the retired `scripts/serve.js`.
     *
     * The Next docs recommend testing against the production build, and here it
     * earns its cost twice over: CSS ordering and chunking only take their final
     * form in `next build`, and the reflow gate is a measurement of the CSS that
     * actually ships. A dev server would gate on a stylesheet no user receives.
     */
    command: `npm run build && npx next start --port ${PORT}`,

    // The prefix is required. `basePath` makes the origin root a 404, and
    // Playwright's readiness probe accepts 2xx/3xx/400/401/402/403 - a 404
    // reads as "not up yet" and the whole run times out waiting for a server
    // that has been listening the entire time.
    url: `http://localhost:${PORT}${BASE_PATH}`,

    // The default 60s covers `next start` alone. This command builds first,
    // which on a cold CI runner does not reliably fit in that.
    timeout: 120_000,

    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
  },
});
