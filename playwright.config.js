import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end config.
 *
 * These tests exist for the things jsdom structurally cannot see: real layout
 * (the WCAG reflow gate is a measurement, not an assertion about markup), and
 * real browser lifecycle - a modal <dialog>'s Escape, which jsdom does not
 * implement at all.
 */

const PORT = 3111;

export default defineConfig({
  // E2E lives in a top-level directory, exempt from the colocation rule that
  // governs unit tests. It is testing the assembled app, not any one module.
  testDir: "./e2e",
  fullyParallel: true,

  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",

    // Pinned so a fixed instant means the same wall-clock time on every
    // machine. This is a property of the TEST HARNESS, not of the app - the
    // app deliberately has no timezone plumbing and reads local wall-clock
    // minutes, which is exactly what this makes reproducible.
    timezoneId: "America/New_York",
  },

  projects: [
    {
      // The Chrome already on the machine, via `channel`, rather than a
      // downloaded Chromium: it is the engine the original review measured in,
      // and it costs no browser binary. WebKit coverage is still owed - see
      // Open gaps in the build log.
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],

  webServer: {
    command: `node scripts/serve.js ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
  },
});
