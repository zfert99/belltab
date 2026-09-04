import { test, expect, type Page } from "@playwright/test";
import { openApp, openSettings, AFTER_SCHOOL, MID_PERIOD } from "./helpers";

/**
 * The day as blocks under the countdown - the plain build's period strip,
 * back as a preference on 2026-09-04.
 *
 * The seeded Regular day has eleven periods: seven blocks and four Passing
 * links. At MID_PERIOD (09:30) Period 2 is running - the second square - with
 * Period 1 and one link behind it.
 */

const strip = (page: Page) => page.locator("#strip");
const cells = (page: Page) => page.locator("#strip .strip__cell");
const caption = (page: Page) => page.locator("#strip-caption");

const prefs = (showStrip: boolean) =>
  JSON.stringify({ theme: "system", bellOffsetSec: 0, showStrip });

test.describe("the blocks strip", () => {
  test("is off by default, and appears under the countdown when ticked", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await expect(strip(page)).toHaveCount(0);

    await openSettings(page, "preferences");
    await page.locator("#show-strip").check();
    await page.locator("#settings-toggle").click();

    await expect(strip(page)).toBeVisible();
    await expect(page.locator("#countdown-minutes")).toHaveText("35");
  });

  test("draws one cell per period - squares for blocks, links for passing", async ({ page }) => {
    await openApp(page, MID_PERIOD, { preferences: prefs(true) });

    await expect(cells(page)).toHaveCount(11);
    await expect(page.locator("#strip .strip__cell--block")).toHaveCount(7);
    await expect(page.locator("#strip .strip__cell--link")).toHaveCount(4);

    // Past, current, future - and the current square is the second block.
    await expect(page.locator("#strip .strip__cell--past")).toHaveCount(2);
    await expect(page.locator("#strip .strip__cell--current")).toHaveCount(1);
    await expect(page.locator("#strip .strip__cell--block").nth(1)).toHaveClass(/--current/);

    // The strip is decorative; the caption is the words.
    await expect(strip(page)).toHaveAttribute("aria-hidden", "true");
    await expect(caption(page)).toHaveText("2 of 7 · 5h 00m until dismissal");
  });

  test("fills the running square by how far through it the day is", async ({ page }) => {
    await openApp(page, MID_PERIOD, { preferences: prefs(true) });

    // 25 minutes into a 60-minute period.
    await expect(page.locator("#strip .strip__cell--current .strip__fill")).toHaveAttribute(
      "style",
      /width:\s*41\.67%/,
    );
    await expect(page.locator("#strip .strip__cell--past .strip__fill").first()).toHaveAttribute(
      "style",
      /width:\s*100%/,
    );
  });

  test("is a state, not a tick: a slept-through bell is right on the next paint", async ({ page }) => {
    await openApp(page, MID_PERIOD, { preferences: prefs(true) });

    await page.clock.setSystemTime(new Date("2026-09-02T10:36:00-04:00"));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

    // Period 3 is the third square; Period 2 and its Passing joined the past.
    await expect(page.locator("#strip .strip__cell--block").nth(2)).toHaveClass(/--current/);
    await expect(page.locator("#strip .strip__cell--past")).toHaveCount(4);
    await expect(caption(page)).toHaveText("3 of 7 · 3h 54m until dismissal");
  });

  test("hovering a square borrows the caption for that period", async ({ page }) => {
    await openApp(page, MID_PERIOD, { preferences: prefs(true) });

    await page.locator("#strip .strip__cell--block").nth(4).hover();
    await expect(caption(page)).toHaveText("Period 4 · 11:35–12:30");

    await page.mouse.move(0, 0);
    await expect(caption(page)).toHaveText("2 of 7 · 5h 00m until dismissal");
  });

  test("after the last bell every cell is full and the caption says so", async ({ page }) => {
    await openApp(page, AFTER_SCHOOL, { preferences: prefs(true) });

    // The countdown shows its own after-school message, which has no strip
    // beneath it - there is nothing left to count.
    await expect(page.locator("#period-name")).toHaveText("School's out");
    await expect(strip(page)).toHaveCount(0);
  });

  test("scales up in Big mode and comes back down", async ({ page }) => {
    await openApp(page, MID_PERIOD, { preferences: prefs(true) });

    const square = () =>
      page.locator("#strip .strip__cell--block").first().evaluate((el) => el.getBoundingClientRect().width);
    const before = await square();

    await page.locator("#view-big").click();
    await expect(page.locator("#big-exit")).toBeVisible();
    await expect(strip(page)).toBeVisible();
    expect(await square()).toBeGreaterThan(before);

    await page.locator("#big-exit").click();
    await expect(strip(page)).toBeVisible();
  });
});
