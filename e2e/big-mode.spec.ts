import { test, expect, type Page } from "@playwright/test";
import { openApp, MID_PERIOD, WEEKEND } from "./helpers";

/**
 * Big mode: the projector.
 *
 * The thing worth testing here is what Big mode ISN'T. It is a presentation
 * mode laid over the Now view rather than a second view, so the assertions
 * below are mostly about sameness — same ids, same numbers, same tab title,
 * same clock — because a second implementation of the countdown is exactly the
 * failure this design exists to prevent, and it would look fine in a screenshot
 * right up until the two drifted apart.
 *
 * The reflow gate covers the geometry at five widths; this file covers the
 * behaviour.
 */

const enter = (page: Page) => page.locator("#view-big");
const exit = (page: Page) => page.locator("#big-exit");
const isBig = (page: Page) => page.evaluate(() => document.body.classList.contains("is-big"));

test.describe("entering and leaving", () => {
  test("the same countdown is still on screen, only bigger", async ({ page }) => {
    await openApp(page, MID_PERIOD);

    await expect(page.locator("#countdown-minutes")).toHaveText("35");
    const ordinary = await page.locator(".countdown__time").boundingBox();

    await enter(page).click();

    // Same elements, same values - this is one countdown wearing a class, and
    // the ids are how that is proved rather than asserted in a comment.
    await expect(page.locator("#period-name")).toHaveText("Period 2");
    await expect(page.locator("#countdown-minutes")).toHaveText("35");
    await expect(page.locator("#countdown-seconds")).toHaveText("00");

    const big = await page.locator(".countdown__time").boundingBox();
    expect(big?.height ?? 0).toBeGreaterThan(ordinary?.height ?? 0);
  });

  test("puts the mode on <body> and takes it off again", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    expect(await isBig(page)).toBe(false);

    await enter(page).click();
    expect(await isBig(page)).toBe(true);

    await exit(page).click();
    expect(await isBig(page)).toBe(false);
    await expect(enter(page)).toBeVisible();
  });

  test("Escape leaves, because the way out is one quiet pill", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await enter(page).click();

    await page.keyboard.press("Escape");

    expect(await isBig(page)).toBe(false);
    await expect(exit(page)).toBeHidden();
  });

  test("focus follows the mode in both directions", async ({ page }) => {
    // Entering unmounts the button that was pressed, so without this the next
    // Tab starts from the top of the document; leaving returns focus to the
    // control that was used, which is where a keyboard user expects to be.
    await openApp(page, MID_PERIOD);

    await enter(page).click();
    await expect(exit(page)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(enter(page)).toBeFocused();
  });

  test("does not steal focus on first paint", async ({ page }) => {
    // The effect that moves focus runs once on mount with the mode off. Without
    // its guard that would put focus on the Big mode button before the user has
    // touched anything.
    await openApp(page, MID_PERIOD);

    await expect(enter(page)).not.toBeFocused();
  });
});

test.describe("what the projector shows", () => {
  test("keeps the schedule name, the wall clock and the bounds footer", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await enter(page).click();

    // "Regular" versus "Half day" is the thing a teacher glancing up wants
    // confirmed, and the footer is the only line that says what is next. The
    // rule that used to hide the footer was written against a period strip that
    // was retired with the plain build and never rebuilt - see globals.css.
    await expect(page.locator("#schedule-name")).toHaveText("Regular");
    await expect(page.locator("#wall-clock")).toHaveText("9:30");
    await expect(page.locator(".bounds__next")).toHaveText("Next: Passing at 10:05");
    await expect(page.locator(".bounds__edge--start")).toHaveText("9:05");
  });

  test("takes away the app's own name and the settings button", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await enter(page).click();

    // `display: none` removes them from the accessibility tree too, which is
    // correct for a presentation mode: there is no route to settings from a
    // projector, so there should be no control announcing one.
    await expect(page.locator(".screen__schedule")).toBeHidden();
    await expect(page.locator("#settings-toggle")).toBeHidden();
  });

  test("the tab title keeps running, at minute resolution", async ({ page }) => {
    // The title is a derived view of the same clock. A mode that is only CSS
    // cannot break it, and this is what says so.
    await openApp(page, MID_PERIOD);
    await enter(page).click();

    await expect(page).toHaveTitle("35m · Period 2");
  });

  test("the clock is still recomputed, not frozen by the mode", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await enter(page).click();

    // The repo's first invariant, checked through the mode: move the clock
    // without firing a timer, then hand the page the event a returning tab
    // gets. The number must be right on the first repaint.
    await page.clock.setSystemTime(new Date("2026-09-02T09:40:00-04:00"));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

    await expect(page.locator("#countdown-minutes")).toHaveText("25");
    expect(await isBig(page)).toBe(true);
  });
});

test.describe("Big mode and the rest of the app", () => {
  test("an empty state's call to action leaves the mode before opening settings", async ({
    page,
  }) => {
    // Not hypothetical: the "No school today" action is a `.minibutton`, which
    // Big mode scales but does not hide. Without the guard in `App.tsx` the
    // settings panel would render inside the full-bleed projector layout.
    await openApp(page, WEEKEND);
    await enter(page).click();
    expect(await isBig(page)).toBe(true);

    await page.getByRole("button", { name: "Pick a schedule for today" }).click();

    await expect(page.locator("#panel-calendar")).toBeVisible();
    expect(await isBig(page)).toBe(false);
  });

  test("adds no live region of its own", async ({ page }) => {
    // Every live region in this app is a decision. Big mode is CSS and a class,
    // so it must not arrive with one.
    await openApp(page, MID_PERIOD);
    await enter(page).click();

    const regions = await page
      .locator('[aria-live], [role="alert"], [role="status"], [role="log"]')
      .evaluateAll((elements) =>
        elements.map((element) => `${element.tagName.toLowerCase()}#${element.id || "(no id)"}`),
      );

    expect(regions.sort()).toEqual(["div#__next-route-announcer__", "p#period-announcer"].sort());
  });
});
