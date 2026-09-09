import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { openApp, openSettings, expectNoHorizontalScroll, MID_PERIOD, STORAGE_KEY } from "./helpers";

/**
 * What happens when the library in `localStorage` cannot be read.
 *
 * The pure half - degrade to the defaults, and SAY WHICH way it failed - is
 * `loadLibraryReport` and is covered in `library.test.ts`. What only a page
 * can prove is the part that used to be missing entirely: that the user is
 * told, that the bytes survive the first save, and that they can be handed
 * back as a file. Found in review on 2026-09-05 by planting one bad period:
 * the seeded defaults on screen, the user's four schedules still on disk, no
 * message, and one keystroke from losing them.
 */

/** Kept in step with `UNREADABLE_KEY` in src/app/_lib/libraryStore.ts. */
const UNREADABLE_KEY = `${STORAGE_KEY}.unreadable`;

const NOT_JSON = "{this is not json";

/** Four real schedules, one with a period that ends before it starts. */
const ONE_BAD_PERIOD = JSON.stringify({
  schedules: [
    { id: "s1", name: "My Regular", periods: [{ name: "P1", kind: "Class", startMin: 480, endMin: 540 }] },
    { id: "s2", name: "My Half Day", periods: [{ name: "P1", kind: "Class", startMin: 480, endMin: 540 }] },
    { id: "s3", name: "My Assembly", periods: [{ name: "Broken", kind: "Class", startMin: 600, endMin: 540 }] },
    { id: "s4", name: "My Delayed", periods: [{ name: "P1", kind: "Class", startMin: 480, endMin: 540 }] },
  ],
  calendar: { weekdays: [null, "s1", "s1", "s1", "s1", "s1", null], overrides: [] },
});

const notice = (page: Page) => page.locator("#library-notice");

const stored = (page: Page, key: string) =>
  page.evaluate((k) => window.localStorage.getItem(k), key);

test.describe("an unreadable saved library", () => {
  test("is announced, and the seeded defaults run in its place", { tag: "@smoke" }, async ({ page }) => {
    await openApp(page, MID_PERIOD, { storage: NOT_JSON });

    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText("couldn’t read the schedules saved in this browser");
    await expect(notice(page)).toContainText("isn’t JSON");
    // The degrade itself is unchanged: the countdown is running the defaults.
    await expect(page.locator("#schedule-name")).toHaveText("Regular");
  });

  test("names the schedule-level reason when that is what failed", async ({ page }) => {
    await openApp(page, MID_PERIOD, { storage: ONE_BAD_PERIOD });

    await expect(notice(page)).toContainText("One of the saved schedules can’t be read");
    await expect(notice(page)).toContainText("A period has to end after it starts");
  });

  test("is NOT shown on a fresh install", async ({ page }) => {
    await openApp(page, MID_PERIOD, { storage: null });

    await expect(notice(page)).toHaveCount(0);
  });

  test("is NOT shown for a library that reads fine", async ({ page }) => {
    const fine = JSON.stringify({
      schedules: [{ id: "s1", name: "Mine", periods: [{ name: "P", kind: "Class", startMin: 480, endMin: 540 }] }],
      calendar: { weekdays: [null, "s1", "s1", "s1", "s1", "s1", null], overrides: [] },
    });
    await openApp(page, MID_PERIOD, { storage: fine });

    await expect(notice(page)).toHaveCount(0);
    await expect(page.locator("#schedule-name")).toHaveText("Mine");
  });

  test("keeps the unreadable bytes aside the first time a change is saved", async ({ page }) => {
    await openApp(page, MID_PERIOD, { storage: ONE_BAD_PERIOD });

    // Nothing has been written yet: the bad value is still under the live key
    // and the quarantine slot is empty. This is the state one keystroke used
    // to destroy.
    expect(await stored(page, STORAGE_KEY)).toBe(ONE_BAD_PERIOD);
    expect(await stored(page, UNREADABLE_KEY)).toBeNull();

    // The keystroke.
    await openSettings(page, "schedules");
    await page.locator("#schedule-name-input").fill("Regular renamed");

    // Quarantined FIRST, then overwritten - the original bytes are intact
    // under their own key, and the live key now holds something readable.
    expect(await stored(page, UNREADABLE_KEY)).toBe(ONE_BAD_PERIOD);
    const live = await stored(page, STORAGE_KEY);
    expect(live).not.toBe(ONE_BAD_PERIOD);
    expect(() => JSON.parse(live ?? "")).not.toThrow();

    // A second save must NOT re-quarantine: the slot holds the bytes that
    // could not be read, and overwriting them with the now-readable library
    // would defeat the point. (No `page.reload()` here on purpose - `openApp`
    // plants storage with `addInitScript`, which runs again on every
    // navigation and would re-plant the bad value; "a readable library shows
    // no banner" has its own test above.)
    await page.locator("#schedule-name-input").fill("Regular renamed twice");
    expect(await stored(page, UNREADABLE_KEY)).toBe(ONE_BAD_PERIOD);
  });

  test("hands the bytes back as a file, exactly as they were", async ({ page }) => {
    await openApp(page, MID_PERIOD, { storage: NOT_JSON });

    const downloading = page.waitForEvent("download");
    await page.locator("#library-notice-download").click();
    const download = await downloading;

    expect(download.suggestedFilename()).toMatch(/^belltab-unreadable-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();
    expect(readFileSync(path, "utf8")).toBe(NOT_JSON);
  });

  test("dismiss hides it without touching the quarantine", async ({ page }) => {
    await openApp(page, MID_PERIOD, { storage: NOT_JSON });

    await page.locator("#library-notice-dismiss").click();
    await expect(notice(page)).toHaveCount(0);

    // Dismissing is "stop telling me", not "throw it away": the first save
    // still moves the bytes aside.
    await openSettings(page, "schedules");
    await page.locator("#schedule-name-input").fill("Regular renamed");
    expect(await stored(page, UNREADABLE_KEY)).toBe(NOT_JSON);
  });
});

test.describe("at 320 CSS px", () => {
  test.use({ viewport: { width: 320, height: 800 } });

  test("the notice reflows to one column", async ({ page }) => {
    await openApp(page, MID_PERIOD, { storage: ONE_BAD_PERIOD });

    await expect(notice(page)).toBeVisible();
    await expectNoHorizontalScroll(page, "320px library notice");
  });
});
