import { test, expect, type Page } from "@playwright/test";
import { openApp, openSettings } from "./helpers";

/**
 * PARKED in full until Phase 3, which is where deleting a schedule comes back.
 *
 * Findings 1 and 3 of `Docs/code-review-2026-08-26.md`, in the browser they
 * were originally measured in. Neither is visible to the unit suite: jsdom
 * implements <dialog>'s `open` attribute but neither showModal nor close, so it
 * takes the app's unsupported-browser path on every run - which is how finding 3
 * went unnoticed - and the Escape collision needs a real modal dispatching a
 * real key event.
 *
 * Kept rather than deleted because these are the two regressions this repo has
 * actually shipped, and the assertions below are the contract the rebuilt
 * dialog has to meet. Phase 1 retired the markup, not the requirement.
 */

const chipNames = (page: Page) => page.locator("#schedule-list .schedchip").allTextContents();

test.describe.fixme("the delete confirmation", () => {
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
    await expect(page.locator("body")).toHaveClass(/is-settings/);
    await expect(page.locator("#focus-view")).toBeHidden();

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
  test("a backdrop click does not dismiss it", async ({ page }) => {
    await page.locator("#schedule-delete").click();
    await expect(page.locator("#confirm-dialog")).toBeVisible();

    await page.mouse.click(4, 4);

    await expect(page.locator("#confirm-dialog")).toBeVisible();
  });
});
