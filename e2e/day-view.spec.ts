import { test, expect, type Page } from "@playwright/test";
import { openApp, AFTER_SCHOOL, BEFORE_SCHOOL, MID_PERIOD, WEEKEND } from "./helpers";

/**
 * The Day view: the whole schedule as a list, where the day stands, what is
 * left. Rebuilt on 2026-09-04 after being retired with the plain build and
 * never ported - see Deviations in Docs/build-log.md.
 *
 * The same rule as the countdown's suite: nothing here counts down. Every
 * value is recomputed from the clock, so the boundary tests move the clock
 * the way a sleeping tab experiences it and expect the list to be right on
 * the next paint. The seeded Regular day: eleven periods, seven of them blocks
 * (Passing is a seam), 08:00 to 14:30; at MID_PERIOD (09:30) Period 2 runs.
 */

const rows = (page: Page) => page.locator("#period-list .period");
const visibleRows = (page: Page) => page.locator("#period-list .period:not([hidden])");
const current = (page: Page) => page.locator('#period-list [aria-current="time"]');
const caption = (page: Page) => page.locator("#day-caption");

async function openDay(page: Page, at: string = MID_PERIOD) {
  await openApp(page, at);
  await page.locator("#view-day").click();
  await expect(page.locator("#day-view")).toBeVisible();
}

test.describe("the Day view", () => {
  test("lists the whole day, marks the running period, and sums it up", async ({ page }) => {
    await openDay(page);

    await expect(page.locator("#view-day")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#view-now")).toHaveAttribute("aria-pressed", "false");
    await expect(rows(page)).toHaveCount(11);

    // Period 2 (09:05-10:05) is running at 09:30, so 35 minutes remain - spelled
    // out, because the rows around it read "55m" and "1h".
    await expect(current(page)).toHaveCount(1);
    await expect(current(page).locator(".period__name")).toHaveText("Period 2");
    await expect(current(page).locator(".period__aside")).toHaveText("35m 00s");
    await expect(current(page).locator(".period__track")).toBeVisible();

    // Two blocks have started of seven; five hours to the 14:30 last bell.
    await expect(caption(page)).toHaveText("2 of 7 · 5h 00m until dismissal");

    // A future row shows its length; the tab title is the countdown's, still.
    await expect(rows(page).nth(4).locator(".period__aside")).toHaveText("55m");
    await expect(page).toHaveTitle("35m · Period 2");
  });

  test("collapses finished periods behind a disclosure, and reveals them", async ({ page }) => {
    await openDay(page);

    // Period 1 and the first Passing are over: hidden, so the running row sits
    // at the top, with a button that says how many and keeps them retrievable.
    await expect(visibleRows(page)).toHaveCount(9);
    const toggle = page.locator("#past-toggle");
    await expect(toggle).toHaveText("2 earlier periods");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(visibleRows(page)).toHaveCount(11);
    await expect(visibleRows(page).first().locator(".period__aside")).toHaveText("done");
  });

  test("recomputes on return: a bell moves the running row and the caption", async ({ page }) => {
    await openDay(page);

    // Ten-thirty-six: Period 3 (10:10-11:05) is running. Moved without a tick
    // and then told to look, the way a hidden tab is.
    await page.clock.setSystemTime(new Date("2026-09-02T10:36:00-04:00"));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

    await expect(current(page).locator(".period__name")).toHaveText("Period 3");
    await expect(current(page).locator(".period__aside")).toHaveText("29m 00s");
    await expect(caption(page)).toHaveText("3 of 7 · 3h 54m until dismissal");
    await expect(page.locator("#past-toggle")).toHaveText("4 earlier periods");
  });

  test("before the first bell nothing has started, and nothing is collapsed", async ({ page }) => {
    await openDay(page, BEFORE_SCHOOL);

    await expect(caption(page)).toHaveText("0 of 7 · 1h 00m until first bell");
    await expect(current(page)).toHaveCount(0);
    await expect(page.locator("#past-toggle")).toHaveCount(0);
    await expect(visibleRows(page)).toHaveCount(11);
  });

  test("after the last bell the day is done, and every row is shown", async ({ page }) => {
    await openDay(page, AFTER_SCHOOL);

    // A finished day with every row hidden behind a toggle would be a list of
    // nothing, so the collapse is off and the rows all read "done".
    await expect(caption(page)).toHaveText("7 of 7 · done for today");
    await expect(page.locator("#past-toggle")).toHaveCount(0);
    await expect(visibleRows(page)).toHaveCount(11);
    await expect(rows(page).last().locator(".period__aside")).toHaveText("done");
  });

  test("shows the countdown's own empty state on a day with no schedule", async ({ page }) => {
    await openApp(page, WEEKEND);
    await page.locator("#view-day").click();

    await expect(page.locator("#day-view")).toHaveCount(0);
    await expect(page.locator("#period-name")).toHaveText("No school today");
    await expect(page.locator("#view-day")).toHaveAttribute("aria-pressed", "true");
  });

  test("Big mode is a mode over the countdown, and comes back to the Day view", async ({
    page,
  }) => {
    await openDay(page);

    await page.locator("#view-big").click();
    await expect(page.locator("#big-exit")).toBeVisible();
    await expect(page.locator("#countdown-minutes")).toHaveText("35");
    await expect(page.locator("#day-view")).toHaveCount(0);

    await page.locator("#big-exit").click();
    await expect(page.locator("#day-view")).toBeVisible();
    await expect(page.locator("#view-day")).toHaveAttribute("aria-pressed", "true");
  });

  test("adds no live region - the announcer above both screens is the bell", async ({ page }) => {
    await openDay(page);

    const regions = await page
      .locator('[aria-live], [role="alert"], [role="status"], [role="log"]')
      .evaluateAll((elements) =>
        elements.map((element) => `${element.tagName.toLowerCase()}#${element.id || "(no id)"}`),
      );

    expect(regions.sort()).toEqual(["div#__next-route-announcer__", "p#period-announcer"].sort());
  });
});
