import { test, expect } from "@playwright/test";
import { openApp, openSettings, expectNoHorizontalScroll, MID_PERIOD } from "./helpers.js";

/**
 * The reflow gate (WCAG 2.2 SC 1.4.10).
 *
 * `AGENTS.md` calls this a blocking check rather than polish, and it is the one
 * requirement in this repo that cannot be asserted anywhere but a real browser:
 * jsdom has no layout, so scrollWidth and clientWidth are both zero there and
 * an equivalent unit test would pass on a page that scrolled in both
 * directions.
 *
 * 320 CSS px is 400% zoom on a 1280px display, which is the width the success
 * criterion actually names.
 */

const WIDTHS = [320, 375, 768, 1024, 1440];

for (const width of WIDTHS) {
  test.describe(`at ${width} CSS px`, () => {
    test.use({ viewport: { width, height: 720 } });

    test("Now, Day and Big all reflow to one column", async ({ page }) => {
      await openApp(page, MID_PERIOD);
      await expectNoHorizontalScroll(page, `${width}px Now view`);

      await page.locator("#view-day").click();
      await expect(page.locator("#day-view")).toBeVisible();
      await expectNoHorizontalScroll(page, `${width}px Day view`);

      // Past periods collapse by default; expanded is the taller, wider state.
      const pastToggle = page.locator("#past-toggle");
      if (await pastToggle.isVisible()) {
        await pastToggle.click();
        await expectNoHorizontalScroll(page, `${width}px Day view, past expanded`);
      }

      await page.locator("#view-big").click();
      await expect(page.locator("#big-exit")).toBeVisible();
      await expectNoHorizontalScroll(page, `${width}px Big mode`);

      await page.locator("#big-exit").click();
    });

    test("every settings panel reflows, including the editor", async ({ page }) => {
      await openApp(page, MID_PERIOD);

      for (const panel of ["schedules", "calendar", "preferences"]) {
        await openSettings(page, panel);
        await expectNoHorizontalScroll(page, `${width}px settings/${panel}`);
        await page.locator("#settings-toggle").click();
      }
    });

    /**
     * The modal is the newest thing on the page and the one most likely to
     * break this: a fixed-position element is not constrained by the body's
     * width, so an over-wide dialog scrolls the document behind it.
     */
    test("the confirm dialog reflows over the page", async ({ page }) => {
      await openApp(page, MID_PERIOD);
      await openSettings(page, "schedules");

      await page.locator("#schedule-delete").click();
      await expect(page.locator("#confirm-dialog")).toBeVisible();

      await expectNoHorizontalScroll(page, `${width}px confirm dialog`);

      const box = await page.locator("#confirm-dialog").boundingBox();
      expect(box.width).toBeLessThanOrEqual(width);
    });

    /**
     * Period names are user input and can be absurd. `AGENTS.md` requires
     * overflow-wrap: break-word globally for exactly this, and a single
     * unbroken word is the shape that finds out. Sixty characters is the real
     * worst case: both the input maxlength and SCHEDULE_LIMITS.nameChars cap
     * a period name there, so nothing longer can reach the view.
     */
    test("an absurd period name wraps instead of widening the page", async ({ page }) => {
      await openApp(page, MID_PERIOD);
      await openSettings(page, "schedules");

      const firstName = page.locator("#period-editor .editrow").first().locator('[data-field="name"]');
      await firstName.fill("A".repeat(60));

      await page.locator("#settings-toggle").click();
      await page.locator("#view-day").click();
      await expect(page.locator("#day-view")).toBeVisible();

      await expectNoHorizontalScroll(page, `${width}px Day view with a 60-character unbroken name`);
    });
  });
}
