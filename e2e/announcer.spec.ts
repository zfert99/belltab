import { test, expect } from "@playwright/test";
import { openApp, openSettings, MID_PERIOD, BEFORE_SCHOOL } from "./helpers";

/**
 * The period announcer: the bell, for a screen-reader user.
 *
 * `AGENTS.md` is explicit that the tab title announces nothing and the
 * countdown must never be live, so a deliberate `aria-live="polite"` region
 * firing ONLY on period boundaries is how the bell is conveyed at all. Getting
 * it wrong in either direction is a real failure: silent, and the app is unusable
 * without sight; chatty, and it reads a ticking number aloud once a second.
 *
 * Phase 2 rebuilt it as `_components/PeriodAnnouncer.tsx`, so most of this file
 * is live again. What is still parked needs the editor (Phase 3) and the
 * calendar UI (Phase 4) to type into.
 */

const LIVE_REGION_SELECTOR = '[aria-live], [role="alert"], [role="status"], [role="log"]';

/**
 * Next injects one of its own, and it is NOT optional.
 *
 * `div#__next-route-announcer__` is `aria-live="assertive"` with `role="alert"`,
 * visually hidden, added by the App Router to announce client-side route
 * changes. It did not exist in the plain build and it cannot be removed. It
 * appears only AFTER hydration, so a test that reads the document straight
 * after `goto` sees an empty page and one that reads it a moment later sees the
 * region - which is why this is awaited rather than sampled.
 *
 * It should stay permanently silent here: BellTab is a single route with no
 * client-side navigation, so there is no route change to announce. Still true
 * after Phase 2 - nothing calls `router.push`.
 */
const NEXT_ROUTE_ANNOUNCER = "div#__next-route-announcer__";

/** Ours, and the only one this app is allowed to own until Phase 3. */
const PERIOD_ANNOUNCER = "p#period-announcer";

test("the page ships exactly two live regions", async ({ page }) => {
  await openApp(page, MID_PERIOD);

  // Awaited, not assumed: Next's region arrives with hydration, and asserting
  // before it lands would pass for the wrong reason and then fail the day the
  // bundle got slower.
  await expect(page.locator(NEXT_ROUTE_ANNOUNCER)).toBeAttached();

  // Not a placeholder assertion. Phase 2 added exactly one clock-driven live
  // region and Phase 3 adds two form-error slots; every one of those is a
  // decision, and this is what makes a fourth arriving unnoticed impossible.
  // Sorted, because DOM order between our region and a framework-injected one
  // is not a guarantee worth asserting.
  const regions = await page
    .locator(LIVE_REGION_SELECTOR)
    .evaluateAll((elements) =>
      elements.map((element) => `${element.tagName.toLowerCase()}#${element.id || "(no id)"}`),
    );

  expect(regions.sort()).toEqual([NEXT_ROUTE_ANNOUNCER, PERIOD_ANNOUNCER].sort());
});

test.describe("the period announcer", () => {
  const announcer = (page: import("@playwright/test").Page) => page.locator("#period-announcer");

  test("is silent on first paint", async ({ page }) => {
    await openApp(page, MID_PERIOD);

    // Describing the period you are already in, the instant the page loads, is
    // noise rather than news.
    await expect(announcer(page)).toHaveText("");
  });

  /**
   * The other half. Silence is only correct if the thing can still speak, and
   * for a screen-reader user this region IS the bell - the tab title announces
   * nothing, and the countdown must never be live.
   */
  test("announces the bell when the clock crosses a boundary", async ({ page }) => {
    await openApp(page, BEFORE_SCHOOL);

    // 07:00 to 08:10: past the 08:00 first bell, into Period 1. fastForward
    // fires due timers at most once, which is also a fair model of a throttled
    // tab waking up - the value has to be right on the first repaint, not
    // caught up to over the next minute.
    await page.clock.fastForward("01:10:00");

    await expect(announcer(page)).toHaveText("Period 1 has started.");
    await expect(page.locator("#period-name")).toHaveText("Period 1");
  });

  test("announces the end of the day exactly once", async ({ page }) => {
    await openApp(page, MID_PERIOD);

    // 09:30 to 14:40, past the 14:30 last bell.
    await page.clock.fastForward("05:10:00");
    await expect(announcer(page)).toHaveText("School is out.");

    // Another ten minutes of the same state must not repeat it. The region is
    // emptied by hand: React holds the same text in its own tree, so if it
    // rewrote the node on any of the ticks that follow, the string would come
    // back and this would fail.
    await announcer(page).evaluate((element) => (element.textContent = ""));
    await page.clock.fastForward("10:00");
    await expect(announcer(page)).toHaveText("");
  });

  /**
   * `AGENTS.md` is explicit: the countdown must never be wrapped in a live
   * region, and neither must the tab title. A per-second announcement would
   * make the app unusable with a screen reader.
   *
   * The missing-element case is asserted separately on purpose. The plain
   * build's version of this test read `getElementById(id)?.closest(sel) !== null`,
   * which evaluates to `true` for an id that does not exist - so a renamed
   * element would have reported itself as WRAPPED rather than as absent, and
   * the failure message would have sent the reader looking for a live region
   * that was never there. Found while porting; see Bugs found in the build log.
   *
   * `day-remaining` is deliberately absent from the list: the Day view it
   * belonged to was retired with the plain build and no phase has scheduled it
   * back. Add it here on the day it returns.
   */
  test("never wraps the ticking values", async ({ page }) => {
    await openApp(page, MID_PERIOD);

    const { missing, wrapped } = await page.evaluate((selector) => {
      const ids = ["countdown-minutes", "countdown-seconds", "period-name", "wall-clock"];
      return {
        missing: ids.filter((id) => document.getElementById(id) === null),
        wrapped: ids.filter((id) => document.getElementById(id)?.closest(selector) != null),
      };
    }, LIVE_REGION_SELECTOR);

    expect(missing, "these ids no longer exist; the test is checking nothing").toEqual([]);
    expect(wrapped).toEqual([]);
  });
});

/**
 * The regression that started all of this, revived by Phase 3.
 *
 * Finding 2 of `Docs/code-review-2026-08-26.md`. The review measured the bug
 * rather than reasoning about it, because it needs a period to actually be
 * running: typing "Chem" into the running period's name wrote four successive
 * announcements, one per keystroke.
 *
 * The unit suite now covers the half that needs no form - `boundaryKey` is
 * keyed on the period's TIMES, so renaming a running period produces the same
 * key - but this is the test that caught it, and a structural fix is only worth
 * as much as the end-to-end proof that the structure is actually wired up.
 */
test.describe("the period announcer, driven through the editor", () => {
  const announcer = (page: import("@playwright/test").Page) => page.locator("#period-announcer");

  test("says nothing while the running period's name is typed", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");

    // Period 2 is 09:05-10:05 and the clock is at 09:30, so this row is the
    // one under the countdown - the exact case the review reproduced.
    const runningName = page.locator("#period-editor .editrow").nth(2).locator('[data-field="name"]');
    await expect(runningName).toHaveValue("Period 2");

    await runningName.fill("");
    await runningName.pressSequentially("Chem", { delay: 20 });

    await expect(runningName).toHaveValue("Chem");
    await expect(announcer(page)).toHaveText("");
  });

  // Live since Phase 4 built the calendar panel.
  test("says nothing when the calendar is repointed", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "calendar");

    const wednesday = page.locator("#weekday-map select").nth(3);
    await wednesday.selectOption("");
    await expect(page.locator("#calendar-today")).toContainText("no school");

    await expect(announcer(page)).toHaveText("");
  });

});
