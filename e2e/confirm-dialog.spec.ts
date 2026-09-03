import { test, expect, type Page } from "@playwright/test";
import { openApp, openSettings, MID_PERIOD } from "./helpers";

/**
 * LIVE since Phase 4, which is where deleting a SCHEDULE came back.
 *
 * Parked from Phase 1 to Phase 3 while the markup it names did not exist. Phase
 * 3 was the period editor - add, rename, retime, reorder, delete PERIODS - and
 * it ships no confirmation because none of those is destructive enough to
 * interrupt for: a deleted period is four fields and the countdown behind the
 * editor shows the result immediately. Deleting a whole named schedule is not,
 * and this is the contract its dialog has to meet.
 *
 * One adjustment on revival, exactly as the parked note predicted: the
 * `is-settings` body class and `#focus-view` belonged to the retired plain
 * build's view switcher. The React app swaps the two screens by conditional
 * render, so "settings is still standing" is now `#settings-view` and its panel
 * being visible.
 *
 * Findings 1 and 3 of `Docs/code-review-2026-08-26.md`, in the browser they
 * were originally measured in. Neither is visible to the unit suite: jsdom 30
 * implements <dialog>'s `open` attribute but neither showModal nor close, so it
 * takes the app's unsupported-browser path on every run - which is how finding 3
 * went unnoticed - and the Escape collision needs a real modal dispatching a
 * real key event.
 *
 * These are the two regressions this repo has actually shipped. Phase 1 retired
 * the markup, not the requirement.
 */

const chipNames = (page: Page) => page.locator("#schedule-list .schedchip").allTextContents();

test.describe("the delete confirmation", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await openSettings(page, "schedules");
  });

  test("opens as a real modal with Cancel focused", async ({ page }) => {
    await page.locator("#schedule-delete").click();

    const dialog = page.locator("#confirm-dialog");
    await expect(dialog).toBeVisible();

    // The dangerous button must never be the one a stray Enter lands on.
    await expect(page.locator('#confirm-dialog button[value="cancel"]')).toBeFocused();
    await expect(page.locator("#confirm-body")).toContainText("cannot be undone");

    // showModal, not show: the rest of the page is inert behind it.
    const modal = await dialog.evaluate((element) => element.matches(":modal"));
    expect(modal).toBe(true);
  });

  /**
   * The regression. A modal <dialog> is an ordinary element in an ordinary
   * document, so its Escape keydown bubbles to the app's own handler, and the
   * dialog's close is only the DEFAULT ACTION of that same event - the page's
   * listener runs first. window.confirm never did this, because a browser
   * modal dispatches no key events to the page at all.
   *
   * Before the fix, one Escape hid the settings view, dropped `is-settings`,
   * painted the countdown underneath, and moved focus to the header - while
   * the Delete modal stayed open on top of it, still wired to applyDelete.
   */
  test("Escape dismisses the dialog and leaves settings standing", async ({ page }) => {
    const before = await chipNames(page);

    await page.locator("#schedule-delete").click();
    await expect(page.locator("#confirm-dialog")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.locator("#confirm-dialog")).toBeHidden();
    await expect(page.locator("#settings-view")).toBeVisible();
    await expect(page.locator("#panel-schedules")).toBeVisible();
    // The countdown must not have come back underneath it.
    await expect(page.locator("#countdown-minutes")).toBeHidden();

    // Dismissing a confirmation is not confirming it.
    expect(await chipNames(page)).toEqual(before);

    // And Escape still means what it meant once the dialog is gone.
    await page.keyboard.press("Escape");
    await expect(page.locator("#settings-view")).toBeHidden();
  });

  /**
   * The review reported that setSettingsOpen(false) never closed the dialog,
   * so leaving settings by any route stranded it. In a browser that supports
   * showModal, the only route that actually did so was the Escape bug above:
   * the inert background behind a modal makes every other one unreachable,
   * which the first version of this test discovered by timing out trying to
   * click the settings toggle through it.
   *
   * So this asserts the guarantee that closes those routes off. The defensive
   * close in setSettingsOpen stays for the paths inertness does not cover - a
   * non-modal show(), or a browser where showModal threw - and is covered by
   * the unit suite, where jsdom has no inertness to hide behind.
   */
  test("traps focus, and its inert background is what protects settings", async ({ page }) => {
    await page.locator("#schedule-delete").click();
    await expect(page.locator("#confirm-dialog")).toBeVisible();

    // Eight presses is four times round the two buttons the dialog holds.
    //
    // Measured in Chrome, the cycle is Cancel -> Delete -> <body> -> Cancel:
    // the wrap point parks focus on the body rather than on the dialog, which
    // looks like an escape and is not one - nothing BEHIND the dialog ever
    // takes focus. Asserted as a set of allowed places rather than as
    // contains(), which the first version of this test failed on the second
    // press for exactly that reason.
    const visited: string[] = [];

    for (let press = 0; press < 8; press++) {
      await page.keyboard.press("Tab");
      visited.push(
        await page.evaluate(() => {
          const active = document.activeElement;
          const dialog = document.getElementById("confirm-dialog");
          if (dialog?.contains(active)) return "dialog";
          if (active === document.body) return "body";
          return `${active?.tagName.toLowerCase()}#${active?.id}`;
        }),
      );
    }

    expect(visited.filter((where) => where !== "dialog" && where !== "body")).toEqual([]);
    expect(visited).toContain("dialog");

    let clickError: Error | null = null;
    await page
      .locator("#settings-toggle")
      .click({ timeout: 1500 })
      .catch((error: Error) => {
        clickError = error;
      });

    expect(clickError, "the settings toggle is reachable through the modal").not.toBeNull();
    await expect(page.locator("#settings-view")).toBeVisible();
    await expect(page.locator("#confirm-dialog")).toBeVisible();
  });

  test("Cancel closes without deleting", async ({ page }) => {
    const before = await chipNames(page);

    await page.locator("#schedule-delete").click();
    await page.locator('#confirm-dialog button[value="cancel"]').click();

    await expect(page.locator("#confirm-dialog")).toBeHidden();
    expect(await chipNames(page)).toEqual(before);
  });

  test("Delete removes the schedule and the days pointing at it", async ({ page }) => {
    const before = await chipNames(page);
    const target = before[0];

    await page.locator("#schedule-delete").click();
    await page.locator("#confirm-ok").click();

    await expect(page.locator("#confirm-dialog")).toBeHidden();

    const after = await chipNames(page);
    expect(after).toHaveLength(before.length - 1);
    expect(after).not.toContain(target);

    // Any weekday that pointed at the deleted schedule has to stop pointing at
    // it rather than dangling.
    await page.locator("#tab-calendar").click();
    const weekdayValues = await page
      .locator("#weekday-map select")
      .evaluateAll((selects) =>
        selects.map((select) => (select as HTMLSelectElement).selectedOptions[0].textContent?.trim()),
      );
    expect(weekdayValues).not.toContain(target);
  });

  /**
   * A documented caveat rather than a bug: `<dialog>` without `closedby`
   * ignores a backdrop click, which is the behaviour you want for something
   * destructive. Asserted so a future `closedby="any"` is a deliberate change
   * rather than an accident.
   */
  test("says so when the schedule being deleted is the one running today", async ({ page }) => {
    // The fixture is a Wednesday inside the Regular day, and the picker opens
    // on today's schedule - so this delete would blank the countdown the
    // moment the dialog closed, which the generic sentence never said.
    await openApp(page, MID_PERIOD);
    await openSettings(page);

    await page.locator("#schedule-delete").click();
    await expect(page.locator("#confirm-body")).toContainText("running today");
    await page.getByRole("button", { name: "Cancel" }).click();

    // A schedule no day points at today gets the plain sentence.
    await page.locator("#schedule-list .schedchip", { hasText: "Delayed start" }).click();
    await page.locator("#schedule-delete").click();
    await expect(page.locator("#confirm-body")).not.toContainText("running today");
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("a backdrop click does not dismiss it", async ({ page }) => {
    await page.locator("#schedule-delete").click();
    await expect(page.locator("#confirm-dialog")).toBeVisible();

    await page.mouse.click(4, 4);

    await expect(page.locator("#confirm-dialog")).toBeVisible();
  });
});
