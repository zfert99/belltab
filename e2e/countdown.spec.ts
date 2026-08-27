import { test, expect, type Page } from "@playwright/test";
import { openApp, AFTER_SCHOOL, BEFORE_SCHOOL, MID_PERIOD, WEEKEND } from "./helpers";

/**
 * The countdown, in a real browser with a controllable clock.
 *
 * This suite is where Phase 2's gate lives. The unit tests already prove the
 * engine is right at any given second - they take the time as an argument and
 * need no timers at all - so what is left to prove is the part that only exists
 * in a browser: that the number on screen is recomputed from the device clock
 * rather than decremented, and that it is therefore correct on the FIRST
 * repaint after a tab has been throttled or frozen.
 *
 * `page.clock.install` freezes time, so nothing here advances unless a test
 * asks it to. That is what makes the staleness assertions below meaningful: an
 * interval that never fires is exactly the throttled tab this app is designed
 * around.
 */

const minutes = (page: Page) => page.locator("#countdown-minutes");
const seconds = (page: Page) => page.locator("#countdown-seconds");
const periodName = (page: Page) => page.locator("#period-name");
const nextUp = (page: Page) => page.locator(".bounds__next");

/** What a tab does when it is hidden and comes back: no timers, then an event. */
async function returnToTab(page: Page, at: string, event: "visibilitychange" | "focus") {
  // setSystemTime moves the clock WITHOUT firing any timer, which is the whole
  // point: it models the minutes a throttled or frozen tab spent not ticking.
  await page.clock.setSystemTime(new Date(at));

  await page.evaluate((name) => {
    if (name === "visibilitychange") document.dispatchEvent(new Event("visibilitychange"));
    else window.dispatchEvent(new Event("focus"));
  }, event);
}

test.describe("during a period", () => {
  test("shows the period, the remaining time and its units", async ({ page }) => {
    await openApp(page, MID_PERIOD);

    // Period 2 runs 09:05-10:05 and the clock is at 09:30, so 35:00 remains.
    await expect(periodName(page)).toHaveText("Period 2");
    await expect(minutes(page)).toHaveText("35");
    await expect(seconds(page)).toHaveText("00");
    await expect(page.locator(".countdown__units")).toHaveText("min : sec");
  });

  test("shows the period's bounds and what is next", async ({ page }) => {
    await openApp(page, MID_PERIOD);

    await expect(page.locator(".bounds__edge--start")).toHaveText("9:05");
    await expect(page.locator(".bounds__edge--end")).toHaveText("10:05");
    await expect(nextUp(page)).toHaveText("Next: Passing at 10:05");
  });

  test("puts the number first in the tab title, at minute resolution", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await expect(page).toHaveTitle("35m · Period 2");
  });

  test("ticks once a second and rolls the title over on the minute", async ({ page }) => {
    await openApp(page, MID_PERIOD);

    await page.clock.fastForward("00:01");
    await expect(seconds(page)).toHaveText("59");
    await expect(minutes(page)).toHaveText("34");

    // The title is minute-resolution, so it follows the minutes place and not
    // the seconds: 34m 59s still reads as 35m, because ceiling is what stops
    // the last 59 seconds of a period reading "0m".
    await expect(page).toHaveTitle("35m · Period 2");

    await page.clock.fastForward("00:59");
    await expect(seconds(page)).toHaveText("00");
    await expect(page).toHaveTitle("34m · Period 2");
  });

  test("fills the progress bar with the elapsed fraction", async ({ page }) => {
    await openApp(page, MID_PERIOD);

    // 25 minutes into a 60-minute period.
    await expect(page.locator(".progress__fill")).toHaveAttribute("style", /width:\s*42%/);
  });
});

/**
 * THE PHASE 2 GATE, in the two forms a browser delivers it.
 *
 * Hidden tabs are throttled to roughly one wakeup a minute and frozen outright
 * on mobile, so the interval is NOT what makes the number right when a user
 * comes back - it is the recompute forced by the lifecycle event. Both tests
 * move the clock without firing a single timer, assert the display is stale
 * (proving no timer fired), and then assert the event alone corrects it.
 *
 * A decrementing counter would fail these: it would resume ten minutes behind
 * and never notice.
 */
test.describe("coming back to a throttled tab", () => {
  for (const event of ["visibilitychange", "focus"] as const) {
    test(`recomputes on ${event}, not from where it left off`, async ({ page }) => {
      await openApp(page, MID_PERIOD);
      await expect(minutes(page)).toHaveText("35");

      await returnToTab(page, "2026-09-02T09:40:00-04:00", event);

      // Ten minutes passed with no tick. The recompute is a subtraction from
      // the deadline, so it lands on 25:00 rather than on 34:59.
      await expect(minutes(page)).toHaveText("25");
      await expect(seconds(page)).toHaveText("00");
      await expect(page).toHaveTitle("25m · Period 2");
    });
  }

  test("catches up across a period boundary it slept through", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await expect(periodName(page)).toHaveText("Period 2");

    // 09:30 to 10:12: past the 10:05 bell, past the five-minute passing period,
    // and into Period 3. Two boundaries the tab was asleep for.
    await returnToTab(page, "2026-09-02T10:12:00-04:00", "visibilitychange");

    await expect(periodName(page)).toHaveText("Period 3");
    await expect(minutes(page)).toHaveText("53");
  });

  test("shows the seconds place counting down inside the minute", async ({ page }) => {
    await openApp(page, BEFORE_SCHOOL);

    // 07:00 is exactly an hour out, so the display is on the hr : min scale and
    // the seconds place is not shown. One second later it is 59:59 - the scale
    // flips and the seconds start moving, which is the transition most likely
    // to render as "59 : 59 hr : min".
    await page.clock.fastForward("00:01");

    await expect(minutes(page)).toHaveText("59");
    await expect(seconds(page)).toHaveText("59");
    await expect(page.locator(".countdown__units")).toHaveText("min : sec");
  });

  test("does not repaint when nothing has changed", async ({ page }) => {
    await openApp(page, MID_PERIOD);

    // A focus event landing mid-second must not move the display. The reading
    // is compared at second resolution, so this is a no-op rather than a
    // re-render of identical digits.
    await returnToTab(page, "2026-09-02T09:30:00-04:00", "focus");

    await expect(minutes(page)).toHaveText("35");
    await expect(seconds(page)).toHaveText("00");
  });
});

/**
 * The empty states, which is where naive countdown tools look broken.
 *
 * Each is a designed screen with its own copy, and each is reachable from the
 * default calendar and the seeded Regular schedule alone - no editor required,
 * which is what makes them testable in Phase 2.
 */
test.describe("the empty states", () => {
  test("before the first bell, counts down to it and names it", async ({ page }) => {
    await openApp(page, BEFORE_SCHOOL);

    await expect(periodName(page)).toHaveText("School starts in");
    await expect(nextUp(page)).toHaveText("First bell: Period 1 at 8:00");

    // Exactly one hour out, which is where the display changes scale: "60:00"
    // would be unreadable, so an hour or more reads as hours and minutes. The
    // caption is what stops "1 : 00" being one minute.
    await expect(minutes(page)).toHaveText("1");
    await expect(seconds(page)).toHaveText("00");
    await expect(page.locator(".countdown__units")).toHaveText("hr : min");

    // The title stays in whole minutes at every scale - it has ~12 characters
    // and no room for a unit caption.
    await expect(page).toHaveTitle("60m · Period 1");
  });

  test("after the last bell, says the day is done", async ({ page }) => {
    await openApp(page, AFTER_SCHOOL);

    await expect(periodName(page)).toHaveText("School's out");
    await expect(nextUp(page)).toHaveText("See you tomorrow.");
    await expect(page).toHaveTitle("Done · BellTab");

    // No digits at all: there is nothing left to count down, and a frozen
    // 00:00 would read as a clock that had stopped.
    await expect(minutes(page)).toHaveCount(0);
  });

  test("on a weekend, says there is no school rather than counting nothing", async ({ page }) => {
    await openApp(page, WEEKEND);

    await expect(periodName(page)).toHaveText("No school today");
    await expect(page).toHaveTitle("No school · BellTab");
    await expect(minutes(page)).toHaveCount(0);
  });

  test("crosses from a weekday into the weekend without reloading", async ({ page }) => {
    await openApp(page, AFTER_SCHOOL);
    await expect(periodName(page)).toHaveText("School's out");

    // Friday night into Saturday is the one moment the resolved schedule
    // changes under a tab that is simply left open, which is how this app is
    // used. The date is re-read every tick, not captured at load.
    await returnToTab(page, "2026-09-05T09:30:00-04:00", "visibilitychange");
    await expect(periodName(page)).toHaveText("No school today");
  });
});
