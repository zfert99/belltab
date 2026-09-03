import { test, expect, type Page } from "@playwright/test";
import { openApp, openSettings, MID_PERIOD, PREFERENCES_STORAGE_KEY } from "./helpers";

/**
 * The preferences panel, and the two things it changes about the app.
 *
 * The pure halves of both are already covered without a browser -
 * `preferences.test.ts` for the boundary, `clock.test.ts` for the shift - so
 * what is left here is what only a real page can prove: that the offset reaches
 * the digits AND the tab title from one place, that a stored theme is on
 * `<html>` before anything is drawn, and that neither survives an export.
 */

const minutes = (page: Page) => page.locator("#countdown-minutes");
const seconds = (page: Page) => page.locator("#countdown-seconds");
const offsetInput = (page: Page) => page.locator("#bell-offset");

/** What the pre-paint script and the React effect both write. */
const themeAttribute = (page: Page) =>
  page.evaluate(() => document.documentElement.getAttribute("data-theme"));

test.describe("the bell offset", () => {
  test("moves the countdown forward without touching the schedule", async ({ page }) => {
    // Period 2 runs 09:05-10:05 and the clock is frozen at 09:30, so 35:00
    // remains with no offset. Ninety seconds of correction makes it 33:30.
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({ theme: "system", bellOffsetSec: 90 }),
    });

    await expect(minutes(page)).toHaveText("33");
    await expect(seconds(page)).toHaveText("30");

    // The period's own times are unchanged, which is the whole point of
    // applying the offset to the clock rather than to the schedule.
    await expect(page.locator(".bounds__edge--start")).toHaveText("9:05");
    await expect(page.locator(".bounds__edge--end")).toHaveText("10:05");
  });

  test("moves it backward for a negative offset", async ({ page }) => {
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({ theme: "system", bellOffsetSec: -90 }),
    });

    await expect(minutes(page)).toHaveText("36");
    await expect(seconds(page)).toHaveText("30");
  });

  test("reaches the tab title as well as the digits", async ({ page }) => {
    // One clock, one subscriber: the title, the body and the announcer are
    // derived views of the same reading, so an offset applied at the seam has
    // to show up in all of them or it was applied in the wrong place.
    //
    // "34m" and not "33m": the title is at minute resolution and rounds UP, so
    // the 33:30 the digits show is 34 minutes in a tab strip. That is
    // `formatTabTitle` doing its job, and the offset moving the number at all
    // is what this asserts.
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({ theme: "system", bellOffsetSec: 90 }),
    });

    await expect(page).toHaveTitle("34m · Period 2");
  });

  test("takes effect from the panel, live, and persists", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    await expect(page.locator("#bell-offset-readout")).toContainText(
      "in step with this device’s clock",
    );

    await offsetInput(page).fill("90");
    await expect(page.locator("#bell-offset-readout")).toContainText(
      "90 seconds ahead of this device’s clock",
    );

    // The countdown is behind the settings view and still running.
    await expect(page).toHaveTitle("34m · Period 2");

    await page.locator("#settings-toggle").click();
    await expect(minutes(page)).toHaveText("33");

    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), PREFERENCES_STORAGE_KEY),
    ).toBe(
      JSON.stringify({
        theme: "system",
        bellOffsetSec: 90,
        keepScreenAwake: false,
        chimeOnBell: false,
        notifyOnBell: false,
        reduceMotion: false,
      }),
    );
  });

  test("refuses a value past the cap and keeps running on the last good one", async ({ page }) => {
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({ theme: "system", bellOffsetSec: 90 }),
    });
    await openSettings(page, "preferences");

    await offsetInput(page).fill("9000");

    await expect(offsetInput(page)).toHaveAttribute("aria-invalid", "true");

    // Both, not one or the other: the hint is the sentence stating the range,
    // which is what somebody who just exceeded it needs to hear.
    await expect(offsetInput(page)).toHaveAttribute(
      "aria-describedby",
      "bell-offset-hint bell-offset-error",
    );

    // The error names what is still in force, and the countdown behind it
    // agrees - an out-of-range keystroke must not quietly become zero.
    await expect(page.locator("#bell-offset-error")).toContainText(
      "still running 90 seconds ahead",
    );
    await expect(page).toHaveTitle("34m · Period 2");
  });

  test("the offset error is a live region that exists before it speaks", async ({ page }) => {
    // A region that appears at the same moment as its message is one screen
    // readers routinely miss, so this node is always in the tree and merely
    // empty. `toHaveText("")` rather than `toBeHidden()` for that reason - it
    // IS attached, and `.visually-hidden` keeps it 1px rather than removing it.
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    const error = page.locator("#bell-offset-error");

    await expect(error).toBeAttached();
    await expect(error).toHaveAttribute("aria-live", "polite");
    await expect(error).toHaveText("");
    await expect(error).toHaveClass("visually-hidden");

    await offsetInput(page).fill("9000");
    await expect(error).toHaveClass("editor__error");
    await expect(error).toContainText("whole number of seconds");
  });

  test("the panel owns exactly three live regions while it is open", async ({ page }) => {
    // The counterpart to the closed-view invariant in announcer.spec.ts and the
    // editor's in editor.spec.ts. Every live region in this app is a decision;
    // this is what makes an extra one arriving unnoticed impossible.
    //
    // It went from one to two when the wake lock landed and to three with the
    // bells, and it caught both on the first run - which is the whole point.
    // Every region here has to be argued for out loud rather than noticed six
    // weeks later: `wake-lock-alert` speaks only for a refused lock and
    // `notify-alert` only for a blocked permission, never for the routine
    // statuses that flip beside them.
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    const regions = await page
      .locator('[aria-live], [role="alert"], [role="status"], [role="log"]')
      .evaluateAll((elements) =>
        elements.map((element) => `${element.tagName.toLowerCase()}#${element.id || "(no id)"}`),
      );

    expect(regions.sort()).toEqual(
      [
        "div#__next-route-announcer__",
        "p#period-announcer",
        "p#bell-offset-error",
        "p#wake-lock-alert",
        "p#notify-alert",
      ].sort(),
    );
  });

  test("an offset changed in one tab reaches the panel open in another", async ({
    page,
    context,
  }) => {
    // `preferencesStore` syncs on the `storage` event, exactly as the library
    // does. Without the draft being dropped when the stored value moves, the
    // second tab's box would keep showing the number typed into it while the
    // readout beside it showed the new one - which is what the first version of
    // this field did. See Bugs found in Docs/build-log.md.
    const laptop = await context.newPage();

    await openApp(page, MID_PERIOD);
    await openApp(laptop, MID_PERIOD);

    await openSettings(page, "preferences");
    await openSettings(laptop, "preferences");

    await offsetInput(page).fill("45");
    await offsetInput(laptop).fill("120");

    // No reload, no tick: the storage event is the only thing that can move it.
    await expect(offsetInput(page)).toHaveValue("120");
    await expect(page.locator("#bell-offset-readout")).toContainText("120 seconds ahead");

    await laptop.close();
  });

  test("treats an emptied box as an edit rather than a reset", async ({ page }) => {
    // `Number("")` is 0. Committing that would wipe a measured offset the
    // instant somebody selected the box to retype it.
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({ theme: "system", bellOffsetSec: 90 }),
    });
    await openSettings(page, "preferences");

    await offsetInput(page).fill("");

    await expect(offsetInput(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#bell-offset-readout")).toContainText("90 seconds ahead");
    await expect(page).toHaveTitle("34m · Period 2");
  });

  test("resets to zero, and the button says so by going flat", async ({ page }) => {
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({ theme: "system", bellOffsetSec: 90 }),
    });
    await openSettings(page, "preferences");

    await page.locator("#bell-offset-reset").click();

    await expect(offsetInput(page)).toHaveValue("0");
    await expect(page.locator("#bell-offset-reset")).toBeDisabled();
    await expect(page).toHaveTitle("35m · Period 2");
  });

  test("degrades a corrupt stored value without breaking the countdown", async ({ page }) => {
    await openApp(page, MID_PERIOD, { preferences: "{not json" });

    await expect(minutes(page)).toHaveText("35");

    await openSettings(page, "preferences");
    await expect(offsetInput(page)).toHaveValue("0");
    await expect(page.locator("#theme-system")).toBeChecked();
  });
});

test.describe("the theme", () => {
  test("is on <html> before anything is drawn", async ({ page }) => {
    // The attribute is written by the inline script at the top of <body>, not
    // by React. Asserting it right after load is what separates "applied before
    // paint" from "applied on mount", which is the flash this exists to stop.
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({ theme: "dark", bellOffsetSec: 0 }),
    });

    expect(await themeAttribute(page)).toBe("dark");
  });

  test("is ABSENT for system, so the OS media query decides", async ({ page }) => {
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({ theme: "system", bellOffsetSec: 0 }),
    });

    expect(await themeAttribute(page)).toBeNull();
  });

  test("changes the page when a radio is pressed, and survives a reload", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    await expect(page.locator("#theme-system")).toBeChecked();
    expect(await themeAttribute(page)).toBeNull();

    await page.locator("#theme-dark").check();
    expect(await themeAttribute(page)).toBe("dark");

    await page.reload();
    expect(await themeAttribute(page)).toBe("dark");
  });

  test("narrows color-scheme so the browser's own chrome follows", async ({ page }) => {
    // The meta tag is written on the server and says "light dark", because the
    // server cannot know what this user chose. These two rules are what stop a
    // forced-light page from keeping dark scrollbars and spinners.
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({ theme: "light", bellOffsetSec: 0 }),
    });

    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
    ).toBe("light");
  });

  test("goes back to following the OS when system is chosen again", async ({ page }) => {
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({ theme: "dark", bellOffsetSec: 0 }),
    });
    await openSettings(page, "preferences");

    await page.locator("#theme-system").check();

    // Removed, not set to "system": `:root[data-theme="dark"]` would stop
    // matching either way, but `:root:not([data-theme="light"])` would still
    // match a "system" root, so a stray value works by accident.
    expect(await themeAttribute(page)).toBeNull();
  });
});

test.describe("preferences and the library", () => {
  test("are stored under their own key and stay out of a backup", async ({ page }) => {
    // The reason for the split: a bell offset measures one building's clock
    // against one device. A backup that carried it would hand that skew to
    // whoever restored the file, and a share link would do it silently.
    //
    // The planted blob spells out every field because the assertion at the
    // bottom pins the stored BYTES, and nothing in this test saves - a partial
    // blob would be read leniently and left untouched, and the pin would fail
    // for a reason that has nothing to do with the split being tested.
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({
        theme: "dark",
        bellOffsetSec: 42,
        keepScreenAwake: true,
        chimeOnBell: false,
        notifyOnBell: false,
        reduceMotion: false,
      }),
    });

    const library = await page.evaluate(
      (key) => window.localStorage.getItem(key) ?? "",
      "belltab.v1",
    );

    // The library key is written on the first save, so an untouched install may
    // hold nothing at all - either way it must not mention preferences.
    expect(library).not.toContain("bellOffsetSec");
    expect(library).not.toContain("theme");
    expect(library).not.toContain("keepScreenAwake");
    expect(library).not.toContain("chimeOnBell");
    expect(library).not.toContain("notifyOnBell");

    const preferences = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      PREFERENCES_STORAGE_KEY,
    );

    // The exact bytes, not a subset. A preference that is read back but never
    // written again is one a later save would silently drop, and asserting the
    // whole string is what makes the round trip through `serializePreferences`
    // part of the contract rather than an implementation detail.
    expect(preferences).toBe(
      JSON.stringify({
        theme: "dark",
        bellOffsetSec: 42,
        keepScreenAwake: true,
        chimeOnBell: false,
        notifyOnBell: false,
        reduceMotion: false,
      }),
    );
  });

  test("survive importing a whole library over the top", async ({ page }) => {
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({ theme: "dark", bellOffsetSec: 42, keepScreenAwake: true }),
    });
    await openSettings(page, "preferences");

    await page.locator("#tab-backup").click();
    await expect(page.locator("#panel-backup")).toBeVisible();

    await page.locator("#backup-import").setInputFiles({
      name: "belltab-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          schedules: [
            {
              id: "imported",
              name: "Imported",
              periods: [{ name: "One", kind: "class", startMin: 540, endMin: 600 }],
            },
          ],
          calendar: {
            weekdays: [null, null, null, "imported", null, null, null],
            overrides: [],
          },
        }),
      ),
    });

    await expect(page.locator("#confirm-dialog")).toBeVisible();
    await page.locator("#confirm-ok").click();
    await expect(page.locator("#confirm-dialog")).toBeHidden();

    // Import replaces every schedule and the whole calendar. It must not reach
    // the device's own settings, which were never in the file.
    expect(await themeAttribute(page)).toBe("dark");

    await page.locator("#tab-preferences").click();
    await expect(offsetInput(page)).toHaveValue("42");

    // The third preference, asserted through storage rather than through the
    // checkbox: whether the box renders ticked depends on whether the engine
    // has the API at all, and this test is about what an import may not touch.
    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), PREFERENCES_STORAGE_KEY),
    ).toContain('"keepScreenAwake":true');
  });
});

test.describe("motion", () => {
  const motionAttribute = (page: Page) =>
    page.evaluate(() => document.documentElement.getAttribute("data-motion"));

  test("is absent by default, so the OS setting decides", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    expect(await motionAttribute(page)).toBeNull();
  });

  test("the toggle puts the override on <html>, and it survives a reload", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    await page.locator("#reduce-motion").check();
    // Polled: the attribute is written by an effect after the commit, and one
    // engine reads the DOM before React gets there.
    await expect.poll(() => motionAttribute(page)).toBe("reduce");

    // And the one animation the design system permits - the period name's
    // 150ms crossfade - is collapsed by the attribute, not merely by the OS.
    // The countdown is behind the panel, so it is read after going back.
    await page.locator("#settings-toggle").click();
    const collapsed = await page
      .locator("#period-name")
      .evaluate((element) => getComputedStyle(element).animationDuration);
    // Engines format 0.01ms differently ("0.00001s", "1e-05s"); the number is
    // what matters: effectively zero, against the 0.15s it is otherwise.
    expect(parseFloat(collapsed)).toBeLessThan(0.001);

    await page.reload();
    await expect.poll(() => motionAttribute(page)).toBe("reduce");
  });
});

test.describe("a large offset", () => {
  test("is told apart from a schedule edit, beside the number", async ({ page }) => {
    await openApp(page, MID_PERIOD, {
      preferences: JSON.stringify({ theme: "system", bellOffsetSec: 90 }),
    });
    await openSettings(page, "preferences");

    // Ninety seconds is a correction that has become an edit made in the one
    // place that does not travel. The cap is not lowered - a building whose
    // bells really are that far out is still real - it is said out loud.
    await expect(page.locator("#bell-offset-warning")).toContainText("edit the schedule instead");

    await page.locator("#bell-offset").fill("12");
    await expect(page.locator("#bell-offset-warning")).toHaveCount(0);
  });
});
