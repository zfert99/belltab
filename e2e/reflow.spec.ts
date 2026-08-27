import { test, expect } from "@playwright/test";
import {
  openApp,
  openSettings,
  expectNoHorizontalScroll,
  AFTER_SCHOOL,
  MID_PERIOD,
  BEFORE_SCHOOL,
  WEEKEND,
} from "./helpers";

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
 *
 * Phase 2 gave it something to measure again: the countdown number is
 * `clamp(4rem, 18vw, 11rem)`, which is the single widest thing this app draws
 * and the reason the clamp has an upper bound at all. Big mode, the settings
 * panels and the confirm dialog still have no markup; those blocks are parked
 * at the bottom rather than deleted, and each names the phase that revives it.
 */

const WIDTHS = [320, 375, 768, 1024, 1440];

for (const width of WIDTHS) {
  test.describe(`at ${width} CSS px`, () => {
    test.use({ viewport: { width, height: 720 } });

    test("the page reflows to one column", async ({ page }) => {
      await openApp(page, MID_PERIOD);
      await expectNoHorizontalScroll(page, `${width}px page`);
    });

    /**
     * Every state the Now view has, at every width.
     *
     * The first version of the parked test below ran only at MID_PERIOD and
     * passed over a live overflow that only appeared before the first bell. A
     * gate that sees one hour of the school day is measuring that hour, not the
     * app - and these four states render genuinely different markup: two of
     * them have no digits at all, and the "before" state is the one on the
     * hr : min scale.
     */
    for (const [state, at] of [
      ["mid-period", MID_PERIOD],
      ["before school", BEFORE_SCHOOL],
      ["after school", AFTER_SCHOOL],
      ["weekend", WEEKEND],
    ]) {
      test(`the countdown reflows to one column (${state})`, async ({ page }) => {
        await openApp(page, at);
        await expectNoHorizontalScroll(page, `${width}px countdown, ${state}`);
      });
    }

    /**
     * The `overflow-wrap: anywhere` fix, measured rather than grepped.
     *
     * Period names are user input and can be one unbroken 60-character word -
     * sixty is the real worst case, since both the editor's `maxlength` and
     * `SCHEDULE_LIMITS.nameChars` cap a name there. In the plain build this was
     * driven through the editor; with the editor retired, the string is put on
     * the page directly, wearing the class the guarantee actually attaches to.
     *
     * `.period__name` and not a bare <p>, and the difference is the whole
     * point. The global rule is `overflow-wrap: break-word`, which wraps a long
     * word but does NOT reduce its min-content contribution - so an
     * intrinsically-sized ancestor still widens to fit it, and the body grid
     * track scrolls the page sideways. `anywhere` is the value that shrinks
     * min-content too. The first version of this test injected a plain
     * paragraph, overflowed at 320 and 375px, and was asserting a guarantee the
     * design system deliberately never made. See globals.css and the build log.
     *
     * That makes this a test of the STYLESHEET rather than of the app, which is
     * a genuine narrowing and is recorded as such in the build log. It is worth
     * keeping in the reduced form because the rule it protects was found by
     * this very gate on its first CI run, and can regress long before Phase 3
     * gives it a user-facing route again.
     */
    test("an absurd period name wraps instead of widening the page", async ({ page }) => {
      await openApp(page, MID_PERIOD);

      await page.evaluate(() => {
        const name = document.createElement("p");
        name.className = "period__name";
        name.textContent = "A".repeat(60);
        document.querySelector("main")?.append(name);
      });

      await expect(page.locator("main .period__name")).toHaveText("A".repeat(60));
      await expectNoHorizontalScroll(page, `${width}px page, 60-character unbroken period name`);
    });
  });
}

/**
 * PARKED until Phases 2-4.
 *
 * Everything below drove the plain build's views and editor. The assertions are
 * unchanged and the ids are the contract the rebuilt UI has to meet; each block
 * is revived by deleting its `.fixme` once the markup it names exists.
 */
for (const width of WIDTHS) {
  test.describe(`at ${width} CSS px (parked)`, () => {
    test.use({ viewport: { width, height: 720 } });

    // Revived by Phase 6 (Big mode); the Day view has no phase scheduled. The
    // Now view half of this is live above.
    test.fixme("Now, Day and Big all reflow to one column", async ({ page }) => {
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

    // Revived by Phase 3 (the editor) and Phase 4 (the calendar panel).
    test.fixme("every settings panel reflows, including the editor", async ({ page }) => {
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
     *
     * Revived by Phase 3, which is where deleting a schedule comes back.
     */
    test.fixme("the confirm dialog reflows over the page", async ({ page }) => {
      await openApp(page, MID_PERIOD);
      await openSettings(page, "schedules");

      await page.locator("#schedule-delete").click();
      await expect(page.locator("#confirm-dialog")).toBeVisible();

      await expectNoHorizontalScroll(page, `${width}px confirm dialog`);

      const box = await page.locator("#confirm-dialog").boundingBox();
      expect(box?.width).toBeLessThanOrEqual(width);
    });

    /**
     * Period names are user input and can be absurd. `AGENTS.md` requires
     * overflow-wrap: break-word globally for exactly this, and a single
     * unbroken word is the shape that finds out. Sixty characters is the real
     * worst case: both the input maxlength and SCHEDULE_LIMITS.nameChars cap
     * a period name there, so nothing longer can reach the view.
     *
     * Run in TWO states, because the first version of this test ran only in
     * MID_PERIOD and passed over a live bug: before the first bell, the Day
     * view's first row is upcoming rather than past, and the layout it takes
     * then overflowed at 768px. A gate that only ever sees one hour of the
     * school day is not measuring the app, it is measuring that hour.
     *
     * Revived by Phase 3. The live test above keeps the CSS half of this
     * guarantee in the meantime; what is parked here is the half that drives
     * it through the editor and out into two different views.
     */
    for (const [state, at] of [
      ["mid-period", MID_PERIOD],
      ["before school", BEFORE_SCHOOL],
    ]) {
      test.fixme(`an absurd period name wraps in every view (${state})`, async ({ page }) => {
        await openApp(page, at);
        await openSettings(page, "schedules");

        const firstName = page
          .locator("#period-editor .editrow")
          .first()
          .locator('[data-field="name"]');
        await firstName.fill("A".repeat(60));

        await page.locator("#settings-toggle").click();

        // The Now view renders the running period's name too, through a
        // different element, so it needs the same guarantee.
        await expectNoHorizontalScroll(
          page,
          `${width}px Now view, ${state}, 60-character unbroken name`,
        );

        await page.locator("#view-day").click();
        await expect(page.locator("#day-view")).toBeVisible();

        await expectNoHorizontalScroll(
          page,
          `${width}px Day view, ${state}, 60-character unbroken name`,
        );
      });
    }
  });
}
