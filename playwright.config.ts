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
 * Three engines, which `AGENTS.md` has asked for from the start.
 *
 * "Playwright, not Cypress for E2E - real WebKit coverage and free
 * parallelization" was the reason this repo chose Playwright, and for four
 * phases it ran one engine anyway. WebKit is where the things this app leans
 * on differ most: `<dialog>`, `:modal`, `inert`, and the native date and time
 * inputs the editor and the calendar are built out of.
 *
 * It earned its keep on the first run - two real defects, both fixed on
 * `main` before these projects landed. See Bugs found, 2026-09-01.
 */
const ALL_ENGINES = [
  {
    // The Chrome already on the machine, via `channel`, rather than a
    // downloaded Chromium: it is the engine the original review measured in,
    // and it costs no browser binary.
    name: "chrome",
    use: { ...devices["Desktop Chrome"], channel: "chrome" },
  },
  {
    // Playwright's WebKit build, and NOT Safari - a distinction this repo
    // learned the hard way. The build here and the one on the Linux CI runner
    // disagree about whether `<input type="time">` exists at all, and neither
    // is what ships on a Mac. A real Safari tab is still an open gap.
    name: "webkit",
    use: { ...devices["Desktop Safari"] },
  },
  {
    name: "firefox",
    use: { ...devices["Desktop Firefox"] },
  },
];

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
   * Two, not Playwright's default of half the machine's cores.
   *
   * Measured rather than chosen, three times over, and the number tracks the
   * WEIGHT of a full run rather than the count of its tests.
   *
   * Phase 4 took the suite from 83 tests to 108, and at eight workers a full run
   * started failing intermittently - sometimes `browserContext.newPage: Target
   * crashed`, sometimes a boot wait timing out, never twice on the same test.
   * Eight browsers plus a `next start` exhaust the machine, and a crashed
   * renderer looks exactly like an app that will not hydrate. Raising the boot
   * timeout made it WORSE, which is the tell: a starved worker given longer
   * holds its slot longer. Four fixed it, on one engine.
   *
   * Three engines take the run to 396 tests and moved the line again. Four
   * failed outright. Three looked clean over three full runs and then produced
   * a single failure, then four - always the boot wait, never the same test
   * twice. Two is clean over repeated runs at 2.5 minutes against three's 1.9.
   * An intermittently red suite is worse than a slow one, because the first
   * thing it costs is the habit of believing it.
   *
   * CI used to keep the default - half the cores, so 2 on the public 4-vCPU
   * runner. Since 2026-09-08 it asks for all of them. This is an EXPERIMENT
   * with a measurement attached, not a setting copied from a guide: the
   * research in Docs/research/e2e-ci-runtime.md names the worker count as the
   * likeliest lever, and the paragraph above names the risk - a starved
   * worker looks like an app that will not hydrate. The bar for keeping it is
   * the same one that set the local number: green across repeated runs. A
   * single boot-wait failure on CI at 100% is the signal to drop back to the
   * default, and the build log will say which it was.
   */
  workers: process.env.CI ? "100%" : 2,

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
  },

  /**
   * Which of the three engines run is decided by `PW_ENGINES`, and the default
   * is Chrome alone.
   *
   * Every one of the 274 tests ran on all three engines on every push, and
   * the E2E job was 7m53s against 20-28s for each of the other six. The
   * research in Docs/research/e2e-ci-runtime.md makes the case this file
   * adopts: the cost is `tests × engines`, and cutting it on the ENGINE axis
   * is legible (you know exactly what a PR did not check: non-Blink
   * rendering) and self-correcting (the full three-engine run happens on
   * every merge to `main` and every night, on a fixed cadence). Cutting it
   * on a "priority" axis - which was the first idea - is neither: which
   * tests are low-risk is a judgement that drifts and nobody revisits.
   *
   * `all` is what `ci.yml` sets for pushes to `main` and for the nightly
   * schedule; a PR gets the default. Locally, `PW_ENGINES=all npm run e2e`
   * is the full run, and the WebKit-specific specs still expect it before
   * a WebKit-shaped change is called done.
   */
  projects: ALL_ENGINES.filter(
    (project) => process.env.PW_ENGINES === "all" || project.name === "chrome",
  ),

  webServer: {
    /**
     * A production build, not `next dev`, and not the retired `scripts/serve.js`.
     *
     * The Next docs recommend testing against the production build, and here it
     * earns its cost twice over: CSS ordering and chunking only take their final
     * form in `next build`, and the reflow gate is a measurement of the CSS that
     * actually ships. A dev server would gate on a stylesheet no user receives.
     */
    //
    // Unless the build is already there. CI's `Next build` job has just made
    // exactly this build, and until 2026-09-09 the E2E job made it again -
    // 25-30 seconds of the same work. With `PW_PREBUILT` set, the job has
    // downloaded that job's `.next` and only `next start` runs. Locally the
    // variable is unset and the build happens here, as before; the suite
    // still measures the CSS that ships either way, because it is the same
    // build either way. Docs/research/e2e-ci-runtime.md, its Stage 1.3.
    command: process.env.PW_PREBUILT
      ? `npx next start --port ${PORT}`
      : `npm run build && npx next start --port ${PORT}`,

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
