import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * `#d8453f` to `rgb(216, 69, 63)`.
 *
 * `getComputedStyle` always reports a resolved colour, never the token or the
 * hex it came from, so comparing against `--danger` means converting.
 */
function hexToRgb(hex: string): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}
import { openApp, openSettings, MID_PERIOD, STORAGE_KEY } from "./helpers";

/**
 * The schedule editor.
 *
 * Phase 3's gate is two claims, and this file is where both are argued: a
 * schedule can be built with the keyboard alone, and no input sequence can
 * produce an invalid schedule.
 *
 * The second one is really a claim about the types - the only function that can
 * mint a `ValidSchedule` is `parseSchedule`, and the only thing the store
 * accepts is one - so what a browser adds is proof that the UI actually goes
 * through that door: that a half-typed overlap reaches the screen as a message
 * and not as a saved schedule, and that the countdown behind it keeps running
 * on the last version that made sense.
 *
 * `page.clock` is paused throughout (see `openApp`), so nothing ticks under an
 * assertion and the countdown's value is a pure function of the schedule.
 */

const rows = (page: Page) => page.locator("#period-editor .editrow");
const field = (row: Locator, name: string) => row.locator(`[data-field="${name}"]`);

/** Every row as `name start length`, which is the whole schedule in one read. */
async function readRows(page: Page): Promise<string[]> {
  return rows(page).evaluateAll((items) =>
    items.map((item) => {
      const value = (selector: string) =>
        (item.querySelector(`[data-field="${selector}"]`) as HTMLInputElement | null)?.value ?? "";
      return `${value("name")} ${value("start")} ${value("length")}`;
    }),
  );
}

test.describe("editing periods", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page);
  });

  test("opens on the schedule running today, in start order", async ({ page }) => {
    await expect(page.locator("#schedule-name-input")).toHaveValue("Regular");
    await expect(rows(page)).toHaveCount(11);

    const first = rows(page).first();
    await expect(field(first, "name")).toHaveValue("Period 1");
    await expect(field(first, "start")).toHaveValue("08:00");

    // A LENGTH, not an end time. "Period 1 is 55 minutes" is how a schedule is
    // described, and it makes start >= end unreachable by typing.
    await expect(field(first, "length")).toHaveValue("55");
  });

  test("renaming a period reaches the countdown", async ({ page }) => {
    // Period 2 is the one running at 09:30, which is the fixture's clock.
    await field(rows(page).nth(2), "name").fill("Chemistry");

    await page.locator("#settings-toggle").click();
    await expect(page.locator("#period-name")).toHaveText("Chemistry");
    await expect(page).toHaveTitle("35m · Chemistry");
  });

  test("retiming a period changes what the countdown is counting", async ({ page }) => {
    // Period 2 runs 09:05-10:05 and the clock is at 09:30. Shortening it to 40
    // minutes moves the deadline to 09:45, and the countdown is RECOMPUTED from
    // that rather than adjusted from the old one.
    //
    // Shortened rather than lengthened on purpose: 70 minutes would run into
    // the Passing period at 10:05, which the editor refuses - as the overlap
    // tests below assert. Shortening leaves a gap, which is legal.
    await field(rows(page).nth(2), "length").fill("40");

    await page.locator("#settings-toggle").click();
    await expect(page.locator("#countdown-minutes")).toHaveText("15");
  });

  test("adding a period lands after the last one and cannot collide", async ({ page }) => {
    await page.locator("#add-period").click();

    await expect(rows(page)).toHaveCount(12);
    const added = rows(page).last();

    // The day ends at 14:30, so that is where the new row starts. The only
    // placement that is guaranteed not to overlap anything.
    await expect(field(added, "start")).toHaveValue("14:30");
    await expect(field(added, "name")).toHaveValue("");

    // Blank name, so it is not saved yet - and the message says why.
    await expect(added.locator(".editrow__error")).toHaveText("Give the period a name.");

    await field(added, "name").fill("Study hall");
    await expect(added.locator(".editrow__error")).toHaveCount(0);
  });

  test("deleting a period removes it and leaves a legal gap", async ({ page }) => {
    // Deleting cannot create an overlap - only a gap, which is legal.
    await rows(page).nth(1).locator('[data-field="delete"]').click();

    await expect(rows(page)).toHaveCount(10);
    await expect(field(rows(page).nth(0), "name")).toHaveValue("Period 1");
    await expect(field(rows(page).nth(1), "name")).toHaveValue("Period 2");

    // 08:55-09:05 now belongs to nobody, which is a state the countdown has a
    // screen for rather than a hole to be patched.
    await expect(field(rows(page).nth(1), "start")).toHaveValue("09:05");
  });

  test("deleting every period is allowed and says so", async ({ page }) => {
    for (let remaining = 11; remaining > 0; remaining--) {
      await rows(page).first().locator('[data-field="delete"]').click();
    }

    await expect(rows(page)).toHaveCount(0);

    await page.locator("#settings-toggle").click();
    await expect(page.locator("#period-name")).toHaveText("This schedule has no periods");
  });
});

/**
 * Reorder, which has to mean something specific here.
 *
 * Periods are stored sorted by start time, so dragging a row up a list would be
 * undone by the next parse. The move changes the TIMES: the pair keeps its own
 * lengths and trades slots.
 */
test.describe("reordering", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page);
  });

  test("moving a period earlier swaps it with its neighbour and retimes both", async ({ page }) => {
    // Rows 4 and 5 are Period 3 (10:10, 55m) and A Lunch (11:05, 30m).
    await rows(page).nth(5).locator('[data-field="up"]').click();

    const moved = await readRows(page);
    expect(moved[4]).toBe("A Lunch 10:10 30");
    expect(moved[5]).toBe("Period 3 10:40 55");

    // The pair still ends where it did, so nothing after it moved.
    expect(moved[6]).toBe("Period 4 11:35 55");
  });

  test("is its own inverse", async ({ page }) => {
    const before = await readRows(page);

    await rows(page).nth(5).locator('[data-field="up"]').click();
    await rows(page).nth(4).locator('[data-field="down"]').click();

    expect(await readRows(page)).toEqual(before);
  });

  test("the ends of the list cannot be moved off it", async ({ page }) => {
    // Disabled rather than absent, so every row has the same control count and
    // a keyboard user's Tab distance to Delete does not change per row.
    await expect(rows(page).first().locator('[data-field="up"]')).toBeDisabled();
    await expect(rows(page).last().locator('[data-field="down"]')).toBeDisabled();
    await expect(rows(page).first().locator('[data-field="down"]')).toBeEnabled();
  });
});

/**
 * THE SECOND HALF OF THE GATE: no input sequence produces an invalid schedule.
 */
test.describe("blocking invalid input", () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page);
  });

  test("an overlap names the period it collides with, on the field that caused it", async ({
    page,
  }) => {
    const row = rows(page).nth(2); // Period 2, 09:05
    await field(row, "start").fill("08:30");

    const message = row.locator(".editrow__error");
    await expect(message).toHaveText(
      "Period 2 overlaps Period 1. Two periods cannot run at the same time.",
    );

    // Bound to the input, not just coloured. A red border says nothing to a
    // screen reader; aria-describedby is what says it, when the offending
    // control takes focus.
    const start = field(row, "start");
    await expect(start).toHaveAttribute("aria-invalid", "true");
    await expect(start).toHaveAttribute("aria-describedby", await message.getAttribute("id") ?? "");

    /*
      And coloured as well as bound - which for the whole of Phase 3 and Phase 4
      it was not.

      `aria-invalid` was set correctly and the rule that paints it lost on
      specificity to the control skin's `border` shorthand, so every invalid
      field was announced properly and drawn as though it were fine. Nothing
      caught it because every test here asserted the ATTRIBUTE, which was never
      the broken part. This measures the computed colour instead.
    */
    const danger = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--danger").trim(),
    );
    const painted = await start.evaluate((element) => getComputedStyle(element).borderTopColor);

    expect(painted, "the invalid field is announced but not drawn").toBe(hexToRgb(danger));
  });

  test("an invalid draft is never saved, and the countdown keeps the last good one", async ({
    page,
  }) => {
    await field(rows(page).nth(2), "start").fill("08:30");
    await expect(rows(page).nth(2).locator(".editrow__error")).toBeVisible();

    // Leaving with the error on screen. There is no Save button and nothing to
    // discard: the invalid draft was never committed.
    await page.locator("#settings-toggle").click();
    await expect(page.locator("#period-name")).toHaveText("Period 2");
    await expect(page.locator(".bounds__edge--start")).toHaveText("9:05");

    // And it did not reach storage either.
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored === null || !stored.includes('"startMin":510')).toBe(true);
  });

  test("a blank schedule name is reported in the editor's live region", async ({ page }) => {
    // The one error with no control to point at, which is why this slot is
    // live and the row-level ones are not.
    await page.locator("#schedule-name-input").fill("");

    await expect(page.locator("#schedule-error")).toHaveText("Give the schedule a name.");
    await expect(page.locator("#schedule-name-input")).toHaveAttribute("aria-invalid", "true");
  });

  test("the editor owns exactly one live region while it is open", async ({ page }) => {
    // The closed-view invariant is asserted in announcer.spec.ts. This is its
    // counterpart: opening the editor adds one region and no more.
    const regions = await page
      .locator('[aria-live], [role="alert"], [role="status"], [role="log"]')
      .evaluateAll((elements) =>
        elements.map((element) => `${element.tagName.toLowerCase()}#${element.id || "(no id)"}`),
      );

    expect(regions.sort()).toEqual(
      ["div#__next-route-announcer__", "p#period-announcer", "p#schedule-error"].sort(),
    );
  });

  test("half-typed times are a normal state, not an error to recover from", async ({ page }) => {
    const row = rows(page).nth(2);
    await field(row, "length").fill("");

    await expect(row.locator(".editrow__error")).toBeVisible();
    await expect(field(row, "length")).toHaveAttribute("aria-invalid", "true");

    // And typing the rest of it clears the message rather than needing a retry.
    await field(row, "length").fill("60");
    await expect(row.locator(".editrow__error")).toHaveCount(0);
  });
});

test.describe("persistence", () => {
  test("an edit survives a reload", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page);
    await field(rows(page).nth(2), "name").fill("Chemistry");

    await page.reload();
    await expect(page.locator("#period-name")).toHaveText("Chemistry");
  });

  test("a corrupt stored value degrades to the seeded schedule", async ({ page }) => {
    // AGENTS.md: localStorage holds convenience, not truth. A tab that will not
    // open because of a bad byte is worse than one that opens on the defaults.
    await openApp(page, MID_PERIOD, { storage: '{"schedules":[{"name":"Broken"' });

    await expect(page.locator("#period-name")).toHaveText("Period 2");
    await expect(page.locator("#schedule-name")).toHaveText("Regular");
  });

  test("a stored library with no schedules shows the onboarding screen", async ({ page }) => {
    // Distinct from corrupt: a user who deleted everything must not have the
    // seed data reappear under them.
    await openApp(page, MID_PERIOD, {
      storage: '{"schedules":[],"calendar":{"weekdays":[],"overrides":[]}}',
    });

    await expect(page.locator("#period-name")).toHaveText("No schedule yet");
    await expect(page).toHaveTitle("BellTab");
  });
});

/**
 * THE FIRST HALF OF THE GATE: built with the keyboard alone.
 *
 * No `click()` anywhere below - only Tab, Enter, Space and typed characters,
 * which is what a keyboard-only user has. Reordering is in here on purpose:
 * it is the operation that would normally be a drag, and the reason it is two
 * buttons is that a button is keyboard-operable by construction rather than by
 * having a keyboard fallback bolted onto a pointer gesture.
 */
test.describe("the keyboard alone", () => {
  /** Tab until the named element has focus, or give up loudly. */
  // The limit is generous because the editor genuinely is a long tab chain:
  // eleven rows of six controls is sixty-six stops before the twelfth row.
  // That is a real observation about the form, recorded in the build log, not
  // a number picked to make the test pass.
  async function tabTo(page: Page, selector: string, limit = 120) {
    for (let press = 0; press < limit; press++) {
      if (await page.locator(selector).evaluate((element) => element === document.activeElement)) {
        return;
      }
      await page.keyboard.press("Tab");
    }
    throw new Error(`${selector} was not reachable by Tab within ${limit} presses`);
  }

  test("a period can be added, named, timed and moved without a mouse", async ({ page }) => {
    await openApp(page, MID_PERIOD);

    await tabTo(page, "#settings-toggle");
    await page.keyboard.press("Enter");

    // Focus follows the view swap, or a keyboard user is left on a control
    // that is no longer rendered and the next Tab starts from the top.
    await expect(page.locator("#settings-title")).toBeFocused();

    await tabTo(page, "#add-period");
    await page.keyboard.press("Enter");
    await expect(rows(page)).toHaveCount(12);

    const added = rows(page).last();
    await tabTo(page, '#period-editor .editrow:last-child [data-field="name"]');
    await page.keyboard.type("Study hall");
    await expect(field(added, "name")).toHaveValue("Study hall");

    // A native time input takes typed digits, segment by segment. That is most
    // of the argument for using one: none of this behaviour is ours.
    await tabTo(page, '#period-editor .editrow:last-child [data-field="start"]');
    await page.keyboard.type("0300PM");
    await expect(field(added, "start")).toHaveValue("15:00");

    // And a native number input takes its arrow keys, which is the other half.
    // Stepping down from the new row's default 45 rather than selecting and
    // retyping: the step behaviour is the browser's, and it is what a keyboard
    // user actually reaches for.
    await tabTo(page, '#period-editor .editrow:last-child [data-field="length"]');
    for (let press = 0; press < 5; press++) await page.keyboard.press("ArrowDown");
    await expect(field(added, "length")).toHaveValue("40");

    // Move it earlier, then back, with the keyboard.
    await tabTo(page, '#period-editor .editrow:last-child [data-field="up"]');
    await page.keyboard.press("Enter");
    expect((await readRows(page))[10]).toBe("Study hall 13:35 40");

    // Escape leaves settings, and the schedule that was typed is running.
    await page.keyboard.press("Escape");
    await expect(page.locator("#settings-view")).toHaveCount(0);
    await expect(page.locator("#settings-toggle")).toBeFocused();
    await expect(page.locator(".bounds__next")).toHaveText("Next: Passing at 10:05");
  });
});
