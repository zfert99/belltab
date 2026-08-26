import { expect } from "@playwright/test";

/**
 * Shared setup for the E2E suites.
 *
 * Everything here exists to make "what time is it" a decision rather than an
 * accident. The app resolves which schedule runs from the weekday and paints
 * from the wall clock, so against a real clock these tests would pass on a
 * Wednesday morning and fail on a Saturday night.
 */

/**
 * The UTC offset on these fixtures is load-bearing, not decoration.
 *
 * `new Date("2026-09-02T09:30:00")` - no offset - parses in the timezone of
 * the NODE PROCESS, while the browser is pinned to America/New_York by
 * playwright.config.js. On a machine in New York the two agree and the suite is
 * green; on a UTC CI runner they are four hours apart, so every test here ran
 * against 05:30 while every comment in the file said 09:30. Three tests failed
 * for what looked like three unrelated reasons.
 *
 * Both fixtures are EDT (UTC-4). A fixture landing between November and March
 * needs -05:00 - which is the whole reason the app itself stores wall-clock
 * minutes and never a `Date`.
 */

/**
 * Wednesday 2 September 2026, 09:30 - inside Period 2 of the Regular day
 * (09:05-10:05), on a weekday the default calendar points at "regular".
 */
export const MID_PERIOD = "2026-09-02T09:30:00-04:00";

/** The same Wednesday at 07:00, before the 08:00 first bell. */
export const BEFORE_SCHOOL = "2026-09-02T07:00:00-04:00";

/**
 * Loads the app with the clock frozen at `at`.
 *
 * clock.install must happen BEFORE goto: the app reads the clock during module
 * evaluation, and a clock installed afterwards would arrive too late to decide
 * the first paint.
 */
export async function openApp(page, at = MID_PERIOD) {
  await page.clock.install({ time: new Date(at) });
  await page.goto("/");

  // The markup ships placeholders and JS fills them in. Waiting for one to be
  // replaced is the app's own signal that it booted.
  await expect(page.locator("#wall-clock")).not.toHaveText("--:--");

  // Then check the browser actually believes the time the fixture names.
  //
  // A timezone skew between the Node process and the pinned browser does not
  // announce itself: the suite still runs, still renders, and still asserts -
  // just against a different hour of the school day. Comparing the wall clock
  // the page believes in against the one the fixture spells out turns that into
  // one failure with an obvious message, instead of scattered ones that each
  // look like a separate bug.
  // Characters 11-15 of an ISO local-time string are its HH:MM. The fixtures
  // are literals in this file, so the shape is guaranteed.
  const expectedWallClock = at.slice(11, 16);
  const browserWallClock = await page.evaluate(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

  expect(
    browserWallClock,
    `clock skew: the fixture names ${expectedWallClock} in America/New_York, but the browser believes ${browserWallClock}. Check the UTC offset on the fixture.`,
  ).toBe(expectedWallClock);
}

/**
 * Every element wider than the viewport, deepest first.
 *
 * A bare scrollWidth assertion tells you the page overflows but not what did
 * it, and "something on the Day view at 320px" is not a bug report. Reported
 * in the failure message so a red run names the culprit.
 */
export async function overflowingElements(page) {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth + 1;

    return [...document.querySelectorAll("body *")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && (box.right > limit || box.left < -1);
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        const id = element.id ? `#${element.id}` : "";
        const cls = element.className && typeof element.className === "string"
          ? `.${element.className.trim().split(/\s+/).join(".")}`
          : "";
        return `${element.tagName.toLowerCase()}${id}${cls} [${Math.round(box.left)}..${Math.round(box.right)}]`;
      })
      .slice(0, 5);
  });
}

/**
 * The reflow gate: WCAG 2.2 SC 1.4.10 requires one column and no
 * two-dimensional scrolling down to 320 CSS px.
 */
export async function expectNoHorizontalScroll(page, label) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  const culprits = scrollWidth > clientWidth + 1 ? await overflowingElements(page) : [];

  expect(
    scrollWidth,
    `${label}: page scrolls horizontally (${scrollWidth} > ${clientWidth}). Widest: ${culprits.join(", ")}`,
  ).toBeLessThanOrEqual(clientWidth + 1);
}

/** Opens Settings and selects one of its three panels. */
export async function openSettings(page, panel = "schedules") {
  await page.locator("#settings-toggle").click();
  await expect(page.locator("#settings-view")).toBeVisible();
  await page.locator(`#tab-${panel}`).click();
  await expect(page.locator(`#panel-${panel}`)).toBeVisible();
}
