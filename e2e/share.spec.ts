import { test, expect, type Page } from "@playwright/test";
import { openApp, openSettings, stubClipboard, MID_PERIOD, STORAGE_KEY } from "./helpers";

/**
 * Sharing, end to end: a link out, a link in, and a file both ways.
 *
 * The unit suite already proves the encoder, the decoder, the caps and the
 * fixtures far more thoroughly than a browser can. What only a browser shows is
 * the wiring - that the link a user copies is the link that opens, that a
 * schedule from a stranger reaches the library only when somebody presses a
 * button, and that the fragment is taken off the address bar afterwards.
 *
 * Nothing here reads the system clipboard. `grantPermissions(["clipboard-write"])`
 * is Chromium-only, and the app deliberately shows the link in a read-only input
 * whether or not the clipboard accepted it - so the input is the thing to read,
 * and the test works the same on all three engines.
 */

/** The share link for whichever schedule the picker has selected. */
async function copyShareLink(page: Page): Promise<string> {
  await page.locator("#schedule-share").click();
  await expect(page.locator("#share-link")).toBeVisible();

  const url = await page.locator("#share-link-url").inputValue();
  expect(url).toContain("#");
  return url;
}

test.describe("when the clipboard is refused", () => {
  test("says so, and still shows the link to copy by hand", async ({ page }) => {
    // The branch that rendered on some engines and was asserted on none - the
    // Clipboard API is refused by permissions policy, by a non-secure context,
    // and by browsers that simply say no - so it is stubbed to refuse here, at
    // the boundary, the way the wake lock and the bells are.
    await stubClipboard(page, "refuse");
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");

    await page.locator("#schedule-share").click();

    await expect(page.locator("#share-link-status")).toHaveText(
      "This browser wouldn’t let BellTab use the clipboard. Copy the link by hand:",
    );
    // And the link is there to be copied - the read-only input is the one
    // control that reliably supports select-all on every platform.
    expect(await page.locator("#share-link-url").inputValue()).toContain("#1.");
  });
});

test.describe("a link out and a link in", () => {
  test("a copied link opens on a schedule the other person can add", async ({ page, context }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");
    const url = await copyShareLink(page);

    // A different page, which is as close to "a different person" as one
    // browser context gets. It has its own storage in a fresh context.
    const recipient = await context.newPage();
    await recipient.goto(url);

    await expect(recipient.locator("#share-offer")).toBeVisible();
    await expect(recipient.locator("#share-offer-text")).toContainText("Regular");
    await expect(recipient.locator("#share-offer-text")).toContainText("11 periods");

    await recipient.close();
  });

  test("adding a shared schedule appends it and changes nothing else", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");

    // Rename first, so the arriving schedule is distinguishable from the four
    // already in the library rather than being a fifth "Regular".
    await page.locator("#schedule-name-input").fill("Sent to you");
    const url = await copyShareLink(page);

    await page.goto(url);
    await expect(page.locator("#share-offer")).toBeVisible();
    await page.locator("#share-add").click();

    // It lands in the picker, which the offer opens on the user's behalf.
    await expect(page.locator("#panel-schedules")).toBeVisible();
    const chips = page.locator("#schedule-list .schedchip");
    await expect(chips).toHaveCount(5);
    await expect(chips.last()).toHaveText("Sent to you");

    // And the calendar is untouched: a schedule somebody sent runs on no day.
    await page.locator("#tab-calendar").click();
    await expect(page.locator("#weekday-map select").nth(3)).toHaveValue("regular");
  });

  /**
   * The fragment comes off the address bar once the link has been dealt with.
   *
   * Two reasons, and the second is the one `AGENTS.md` cares about: a refresh
   * should not re-offer a schedule that was declined, and the URL should stop
   * carrying somebody's schedule into this browser's history and history sync.
   */
  test("dismissing takes the schedule out of the URL", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");
    const url = await copyShareLink(page);

    await page.goto(url);
    await page.locator("#share-dismiss").click();

    await expect(page.locator("#share-offer")).toHaveCount(0);
    expect(page.url()).not.toContain("#");

    await page.reload();
    await expect(page.locator("#share-offer")).toHaveCount(0);
  });

  test("adding also clears it, so a refresh does not add it twice", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");
    const url = await copyShareLink(page);

    await page.goto(url);
    await page.locator("#share-add").click();
    expect(page.url()).not.toContain("#");

    await page.reload();
    await expect(page.locator("#share-offer")).toHaveCount(0);
    await openSettings(page, "schedules");
    await expect(page.locator("#schedule-list .schedchip")).toHaveCount(5);
  });

  /**
   * Pasting a link into a tab that is ALREADY on BellTab changes only the
   * fragment, which is a same-document navigation: nothing reloads and React
   * never remounts. The first version of this feature read the fragment on
   * mount alone and did nothing at all here.
   */
  test("a link pasted into an open tab is noticed without a reload", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");
    await page.locator("#schedule-name-input").fill("Pasted");
    const url = await copyShareLink(page);

    await page.locator("#settings-toggle").click();
    await expect(page.locator("#countdown-minutes")).toBeVisible();

    await page.evaluate((target) => {
      window.location.hash = new URL(target).hash;
    }, url);

    await expect(page.locator("#share-offer")).toBeVisible();
    await expect(page.locator("#share-offer-text")).toContainText("Pasted");
  });

  test("a damaged link says so instead of pretending nothing arrived", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await page.evaluate(() => {
      window.location.hash = "1.thisisnotdeflatedata";
    });

    await expect(page.locator("#share-offer")).toHaveClass(/offer--error/);
    await expect(page.locator("#share-offer-text")).toContainText("damaged");
    // Nothing to add - the only way out of an error is to dismiss it.
    await expect(page.locator("#share-add")).toHaveCount(0);
  });

  test("a link from a newer BellTab is distinguished from a broken one", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await page.evaluate(() => {
      window.location.hash = "99.q1bKS8xNVbJSclTSUSpILcrMTylWsoquBQA";
    });

    // The remedy differs, so the message has to: "update" rather than "ask for
    // the link again".
    await expect(page.locator("#share-offer-text")).toContainText("newer version");
  });
});

test.describe("backup", () => {
  test("exports a readable file that imports again", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");
    await page.locator("#schedule-name-input").fill("Before the backup");

    // A tab click, not `openSettings` - settings is already open, and that
    // helper starts by pressing the toggle, which would close it.
    await page.locator("#tab-backup").click();
    await expect(page.locator("#panel-backup")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#backup-export").click(),
    ]);

    const path = await download.path();
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(path, "utf8");

    // Plain and readable, which is what the plan asks a backup to be.
    const parsed = JSON.parse(text) as { schedules: { name: string }[] };
    expect(Object.keys(parsed).sort()).toEqual(["calendar", "schedules"]);
    expect(parsed.schedules[0].name).toBe("Before the backup");
    expect(download.suggestedFilename()).toContain("2026-09-02");

    // Now wreck the library and put it back from the file.
    await page.locator("#tab-schedules").click();
    await page.locator("#schedule-name-input").fill("Wrecked");
    await expect(page.locator("#schedule-list .schedchip").first()).toHaveText("Wrecked");

    await page.locator("#tab-backup").click();
    await page.locator("#backup-import").setInputFiles({
      name: "belltab-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });

    // Destructive, so it asks first.
    await expect(page.locator("#confirm-dialog")).toBeVisible();
    await expect(page.locator("#confirm-body")).toContainText("be undone");
    await page.locator("#confirm-ok").click();

    await page.locator("#tab-schedules").click();
    await expect(page.locator("#schedule-list .schedchip").first()).toHaveText("Before the backup");
  });

  test("cancelling the import leaves the library alone", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "backup");

    await page.locator("#backup-import").setInputFiles({
      name: "other.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"schedules":[{"id":"x","name":"Replacement","periods":[]}],"calendar":{}}'),
    });

    await expect(page.locator("#confirm-dialog")).toBeVisible();
    await page.locator('#confirm-dialog button[value="cancel"]').click();

    await page.locator("#tab-schedules").click();
    await expect(page.locator("#schedule-list .schedchip")).toHaveCount(4);
  });

  /**
   * A file the user CHOSE must never degrade silently.
   *
   * `loadLibrary` swallows every error, because a corrupt `localStorage` value
   * must not stop the app opening. Import is the opposite situation, and
   * replacing somebody's library with seed data because they picked the wrong
   * file would be the worst answer available.
   */
  test("a file that is not a backup is reported, not swallowed", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "backup");

    await page.locator("#backup-import").setInputFiles({
      name: "holiday-photo.json",
      mimeType: "application/json",
      buffer: Buffer.from("this is not json at all"),
    });

    await expect(page.locator("#backup-error")).toContainText("not JSON");
    await expect(page.locator("#confirm-dialog")).toBeHidden();

    // And nothing changed.
    await page.locator("#tab-schedules").click();
    await expect(page.locator("#schedule-list .schedchip")).toHaveCount(4);

    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored === null || stored.includes("Regular")).toBe(true);
  });
});
