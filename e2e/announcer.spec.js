import { test, expect } from "@playwright/test";
import { openApp, openSettings, MID_PERIOD, BEFORE_SCHOOL } from "./helpers.js";

/**
 * Finding 2 of `Docs/code-review-2026-08-26.md`, and its counterpart.
 *
 * The review measured the bug here rather than reasoning about it, because it
 * needs a period to actually be running: typing "Chem" into the running
 * period's name wrote four successive announcements, one per keystroke. The
 * unit suite now covers the same ground with a frozen clock; this is the
 * version in a browser that really has an accessibility tree.
 */

const announcer = (page) => page.locator("#period-announcer");

test.describe("the period announcer", () => {
  test("is silent on first paint", async ({ page }) => {
    await openApp(page, MID_PERIOD);

    // Describing the period you are already in, the instant the page loads, is
    // noise rather than news.
    await expect(announcer(page)).toHaveText("");
  });

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

  test("says nothing when the calendar is repointed", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "calendar");

    const wednesday = page.locator("#weekday-map select").nth(3);
    await wednesday.selectOption("");
    await expect(page.locator("#calendar-today")).toContainText("no school");

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

    // Another ten minutes of the same state must not repeat it.
    await announcer(page).evaluate((element) => (element.textContent = ""));
    await page.clock.fastForward("10:00");
    await expect(announcer(page)).toHaveText("");
  });

  /**
   * `AGENTS.md` is explicit: the countdown must never be wrapped in a live
   * region, and neither must the tab title. A per-second announcement would
   * make the app unusable with a screen reader.
   */
  test("never wraps the ticking values", async ({ page }) => {
    await openApp(page, MID_PERIOD);

    const wrapped = await page.evaluate(() => {
      const selector = '[aria-live], [role="alert"], [role="status"], [role="log"]';
      return ["countdown-minutes", "countdown-seconds", "period-name", "wall-clock", "day-remaining"]
        .filter((id) => document.getElementById(id)?.closest(selector) !== null);
    });

    expect(wrapped).toEqual([]);
  });
});
