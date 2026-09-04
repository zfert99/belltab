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
 * and the reason the clamp has an upper bound at all. Phase 4 added the two
 * surfaces most likely to break it - a panel built out of `<select>`s whose
 * options are user-typed names, and a modal whose fixed positioning escapes the
 * body's width. Phase 6 added the preferences panel and Big mode, and with Big
 * mode the parked list at the bottom of this file is empty - every block it
 * held has been revived by the phase it named.
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

    /**
     * The editor, which is the part `AGENTS.md` predicted would break this.
     *
     * It is a six-column grid of native controls at full width, and a
     * `<input type="time">` in Chrome renders "08:00 AM" plus a picker icon
     * whatever you ask of it. Both stacking breakpoints - one at 45rem for the
     * columns, one at 22.5rem for the time field itself - were added because
     * this measured them, not because they looked right.
     */
    test("the editor reflows to one column", async ({ page }) => {
      await openApp(page, MID_PERIOD);
      await openSettings(page, "schedules");
      await expectNoHorizontalScroll(page, `${width}px settings/schedules`);
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
     * Revived by Phase 3, minus its Day view half - that view was retired with
     * the plain build and its remaining assertions were deleted on 2026-09-01.
     * What is live is the part that matters most anyway: the string goes in
     * through the editor, where a user would actually put it, and has to
     * survive both the form it was typed into and the countdown it comes out
     * on.
     */
    for (const [state, at] of [
      ["mid-period", MID_PERIOD],
      ["before school", BEFORE_SCHOOL],
    ]) {
      test(`an absurd period name wraps everywhere it lands (${state})`, async ({ page }) => {
        await openApp(page, at);
        await openSettings(page, "schedules");

        const firstName = page
          .locator("#period-editor .editrow")
          .first()
          .locator('[data-field="name"]');
        await firstName.fill("A".repeat(60));

        // The SCHEDULE's name too, which is equally user-controlled and which
        // the old version of this test never measured - it drove a hostile
        // period name through an editor whose own title field was left on
        // "Regular". It lands in the header, beside the wall clock.
        await page.locator("#schedule-name-input").fill("B".repeat(60));

        // The editor itself first: a 60-character value in a text input is the
        // widest thing the form can be asked to hold.
        await expectNoHorizontalScroll(
          page,
          `${width}px editor, ${state}, 60-character unbroken name`,
        );

        await page.locator("#settings-toggle").click();

        // Then the countdown, which renders the same string through a
        // different element and needs the same guarantee.
        await expectNoHorizontalScroll(
          page,
          `${width}px countdown, ${state}, 60-character unbroken name`,
        );
      });
    }

    /**
     * The calendar panel, live since Phase 4, and run with a hostile name in
     * the library rather than the seeded ones.
     *
     * The panel is mostly `<select>`s, and a select is sized by its WIDEST
     * OPTION - every one of which here is a schedule name the user typed. That
     * is a second route to the overflow the period-name rule in globals.css
     * documents, arriving through a control rather than through text, and the
     * seeded names are all short enough to hide it.
     */
    test("the calendar panel reflows with a 60-character schedule name in it", async ({ page }) => {
      const hostile = "C".repeat(60);

      await openApp(page, MID_PERIOD);
      await openSettings(page, "schedules");

      await page.locator("#schedule-name-input").fill(hostile);
      await expect(page.locator("#schedule-list .schedchip").first()).toHaveText(hostile);
      await expectNoHorizontalScroll(page, `${width}px settings/schedules, hostile name`);

      await page.locator("#tab-calendar").click();
      await expect(page.locator("#panel-calendar")).toBeVisible();
      await expectNoHorizontalScroll(page, `${width}px settings/calendar, hostile name`);

      // And again with a dated exception listed, which renders the name a
      // third way - as text in a flex row rather than inside a control.
      await page.locator("#override-date").fill("2026-09-14");
      await page.locator("#override-schedule").selectOption({ label: hostile });
      await page.locator("#override-add").click();
      await expect(page.locator("#overrides li")).toHaveCount(1);

      await expectNoHorizontalScroll(page, `${width}px settings/calendar, exception listed`);
    });

    /**
     * The modal is the newest thing on the page and the one most likely to
     * break this: a fixed-position element is not constrained by the body's
     * width, so an over-wide dialog scrolls the document behind it.
     *
     * Live since Phase 4, which is where deleting a schedule came back.
     */
    test("the confirm dialog reflows over the page", async ({ page }) => {
      await openApp(page, MID_PERIOD);
      await openSettings(page, "schedules");

      await page.locator("#schedule-delete").click();
      await expect(page.locator("#confirm-dialog")).toBeVisible();

      await expectNoHorizontalScroll(page, `${width}px confirm dialog`);

      const box = await page.locator("#confirm-dialog").boundingBox();
      expect(box?.width).toBeLessThanOrEqual(width);
    });

    /**
     * The preferences panel, live since Phase 6. Run at the widest offset the
     * panel can hold, because the readout under the number box is a full
     * sentence and the row above it is a flex line of three controls - the two
     * shapes most likely to refuse to stack.
     */
    test("the preferences panel reflows", async ({ page }) => {
      await openApp(page, MID_PERIOD, {
        preferences: JSON.stringify({ theme: "dark", bellOffsetSec: -300 }),
      });
      await openSettings(page, "preferences");

      await expectNoHorizontalScroll(page, `${width}px settings/preferences`);
    });

    /**
     * Big mode, live since Phase 6 and the last block to come off the parked
     * list. It is the hardest of these to satisfy: the countdown is
     * `clamp(4rem, min(26vw, 30vh), 26rem)`, so at 320px it is being asked to
     * draw the widest thing in the app at its most constrained.
     *
     * **The Day view's half of this was deleted on 2026-09-01, not parked.** It
     * drove `#view-day`, `#day-view` and `#past-toggle` through a view the
     * retired plain build shipped and no phase ever scheduled back - so unlike
     * every other parked block it named no phase, and its ids were a contract
     * nothing had agreed to. See Docs/build-log.md.
     */
    test("Now, Day and Big all reflow to one column", async ({ page }) => {
      // With the blocks strip on: fifteen cells that must shrink, not scroll.
      await openApp(page, MID_PERIOD, {
        preferences: JSON.stringify({ theme: "system", bellOffsetSec: 0, showStrip: true }),
      });
      await expect(page.locator("#strip")).toBeVisible();
      await expectNoHorizontalScroll(page, `${width}px Now view with the strip`);

      // The Day view's rows stack their time column under 30rem; eleven of
      // them, with the running row's track, must not widen the page either.
      await page.locator("#view-day").click();
      await expect(page.locator("#day-view")).toBeVisible();
      await expectNoHorizontalScroll(page, `${width}px Day view`);
      await page.locator("#past-toggle").click();
      await expectNoHorizontalScroll(page, `${width}px Day view, past shown`);
      await page.locator("#view-now").click();

      await page.locator("#view-big").click();
      await expect(page.locator("#big-exit")).toBeVisible();
      await expectNoHorizontalScroll(page, `${width}px Big mode`);

      await page.locator("#big-exit").click();
    });
  });
}
