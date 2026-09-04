import { test, expect } from "@playwright/test";
import { openApp, openSettings, MID_PERIOD, WEEKEND } from "./helpers";

/**
 * Phase 4's gate: a late-start Wednesday and a one-off assembly both resolve
 * correctly, and the weekend shows the no-schedule state.
 *
 * The unit suite already proves the resolver and the library mutators in
 * isolation, and proves them far more thoroughly than a browser can. What only
 * a browser can show is that the two are WIRED: that changing a select in the
 * calendar panel reaches the countdown behind it, through the store, without a
 * reload and without a timer.
 *
 * Every test here runs on a PAUSED clock. Nothing below waits for a tick,
 * because nothing below should need one - the countdown recomputes from one
 * reading of `Date.now()` whenever the library changes, and a test that had to
 * wait a second for the screen to catch up would be documenting a bug.
 */

/** The countdown's own header line: which schedule the day resolved to. */
const scheduleName = (page: import("@playwright/test").Page) => page.locator("#schedule-name");

/** The big label above the digits: the running period, or an empty-state headline. */
const periodName = (page: import("@playwright/test").Page) => page.locator("#period-name");

const backToCountdown = async (page: import("@playwright/test").Page) => {
  await page.locator("#settings-toggle").click();
  await expect(page.locator("#settings-view")).toBeHidden();
};

test.describe("the calendar resolves the day", () => {
  /**
   * The weekday map, which is the layer a whole school year is built on.
   *
   * The fixture is Wednesday 09:30. On Regular that is inside Period 2
   * (09:05-10:05); on Delayed start the first bell is not until 10:00, so the
   * same instant is the before-school state. One repoint changes the answer to
   * a different KIND of answer, which is a stronger check than a different
   * number would be.
   */
  test("a late start on Wednesday changes what Wednesday runs", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await expect(scheduleName(page)).toHaveText("Regular");
    await expect(periodName(page)).toHaveText("Period 2");

    await openSettings(page, "calendar");
    await expect(page.locator("#calendar-today")).toContainText("it runs Regular");

    // Index 3 is Wednesday: the map is indexed 0 = Sunday to match getDay().
    await page.locator("#weekday-map select").nth(3).selectOption({ label: "Delayed start" });
    await expect(page.locator("#calendar-today")).toContainText("it runs Delayed start");

    await backToCountdown(page);
    await expect(scheduleName(page)).toHaveText("Delayed start");
    await expect(periodName(page)).toHaveText("School starts in");
    await expect(page.locator(".bounds__next")).toContainText("First bell");
  });

  /**
   * The override layer, which has to beat the weekday map underneath it.
   *
   * The weekday is left pointing at Regular throughout, so the only reason the
   * screen can say "Assembly" is the dated exception winning - which is the
   * priority order the resolver promises.
   */
  test("a one-off assembly beats the weekday it lands on", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "calendar");

    await page.locator("#override-date").fill("2026-09-02");
    await page.locator("#override-schedule").selectOption({ label: "Assembly" });
    await page.locator("#override-add").click();

    const listed = page.locator("#overrides li");
    await expect(listed).toHaveCount(1);
    await expect(listed).toContainText("2026-09-02");
    await expect(listed).toContainText("Assembly");

    // The weekday underneath is untouched, which is what makes this an override.
    await expect(page.locator("#weekday-map select").nth(3)).toHaveValue("regular");
    await expect(page.locator("#calendar-today")).toContainText("it runs Assembly");

    await backToCountdown(page);
    await expect(scheduleName(page)).toHaveText("Assembly");
    await expect(periodName(page)).toHaveText("Assembly");

    // And removing it falls back rather than closing the school.
    await openSettings(page, "calendar");
    await page.locator("#overrides li button").click();
    await expect(page.locator("#overrides li")).toHaveCount(0);

    await backToCountdown(page);
    await expect(scheduleName(page)).toHaveText("Regular");
    await expect(periodName(page)).toHaveText("Period 2");
  });

  /**
   * A closure, which is the case that proves the resolver checks for the ENTRY
   * rather than for its value. A snow day on a Wednesday has to beat "Wednesday
   * is Regular", and an override to null is how it says so.
   */
  test("a dated closure shuts a school day that the weekday map opens", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "calendar");

    await page.locator("#override-date").fill("2026-09-02");
    await page.locator("#override-schedule").selectOption({ label: "No school" });
    await page.locator("#override-add").click();

    await expect(page.locator("#calendar-today")).toContainText("there is no school scheduled");

    await backToCountdown(page);
    await expect(periodName(page)).toHaveText("No school today");
  });

  /**
   * The weekend, and the way out of it.
   *
   * The empty state used to be a dead end: honest copy and nowhere to go, which
   * the design system had asked for since before there was anywhere to link to.
   */
  test("the weekend shows no school, and links into the calendar", async ({ page }) => {
    await openApp(page, WEEKEND);
    await expect(periodName(page)).toHaveText("No school today");

    await page.getByRole("button", { name: "Pick a schedule for today" }).click();
    await expect(page.locator("#panel-calendar")).toBeVisible();
    await expect(page.locator("#calendar-today")).toContainText("Saturday");
    await expect(page.locator("#calendar-today")).toContainText("no school");

    // "Use this schedule today" is an OVERRIDE, not a change to Saturdays in
    // general - a make-up day is one Saturday, not every Saturday.
    await page.locator("#today-schedule").selectOption({ label: "Regular" });
    await expect(page.locator("#calendar-today")).toContainText("it runs Regular");
    await expect(page.locator("#weekday-map select").nth(6)).toHaveValue("");
    // With its weekday in front, since a school year is planned around "the
    // Saturday" and not "the 5th" - computed on the string, not through a
    // `Date` that would call it Friday evening west of Greenwich.
    await expect(page.locator("#overrides li")).toContainText("Sat 2026-09-05");

    await backToCountdown(page);
    await expect(scheduleName(page)).toHaveText("Regular");
    await expect(periodName(page)).toHaveText("Period 2");
  });

  /**
   * Deleting the schedule a day points at must not leave the calendar pointing
   * at a ghost. The weekday degrades to "no school", which is a screen the app
   * renders properly; the override is dropped outright, because turning it into
   * a null would quietly invent a snow day the user never asked for.
   */
  test("deleting a schedule takes the days pointing at it with it", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "calendar");

    await page.locator("#override-date").fill("2026-09-14");
    await page.locator("#override-schedule").selectOption({ label: "Assembly" });
    await page.locator("#override-add").click();
    await expect(page.locator("#overrides li")).toHaveCount(1);

    await page.locator("#tab-schedules").click();
    await page.locator("#schedule-list .schedchip", { hasText: "Assembly" }).click();
    await page.locator("#schedule-delete").click();
    await page.locator("#confirm-ok").click();

    await page.locator("#tab-calendar").click();
    await expect(page.locator("#overrides li")).toHaveCount(0);

    // Wednesday pointed at Regular, which is still there, so the day is intact.
    await expect(page.locator("#weekday-map select").nth(3)).toHaveValue("regular");
    await expect(page.locator("#calendar-today")).toContainText("it runs Regular");
  });
});

test.describe("the schedule library", () => {
  const chips = (page: import("@playwright/test").Page) => page.locator("#schedule-list .schedchip");

  /**
   * Duplicate-and-tweak, which the plan names as the primary authoring move: a
   * late-start day is the regular day with different numbers, and typing eleven
   * periods again to say so is the thing this avoids.
   */
  test("duplicating leaves the original, and its days, alone", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");

    await expect(chips(page)).toHaveCount(4);
    await page.locator("#schedule-duplicate").click();

    await expect(chips(page)).toHaveCount(5);
    await expect(chips(page).nth(1)).toHaveText("Regular (copy)");
    await expect(chips(page).nth(1)).toHaveAttribute("aria-pressed", "true");

    // The editor followed the selection, and the copy carries the periods.
    await expect(page.locator("#schedule-name-input")).toHaveValue("Regular (copy)");
    await expect(page.locator("#period-editor .editrow")).toHaveCount(11);

    await page.locator("#schedule-name-input").fill("Two-hour delay");
    await expect(chips(page).nth(1)).toHaveText("Two-hour delay");

    // The original is untouched and Wednesday still runs it.
    await expect(chips(page).nth(0)).toHaveText("Regular");
    await backToCountdown(page);
    await expect(scheduleName(page)).toHaveText("Regular");
  });

  /**
   * The onboarding path, which was reachable only by hand-editing localStorage
   * until Phase 4 gave it a button. The storage fixture is the state a user who
   * deleted everything is left in - deliberately not a corrupt value, which
   * degrades to the seeds instead.
   */
  test("a schedule can be built from nothing and pointed at today", async ({ page }) => {
    await openApp(page, MID_PERIOD, {
      storage: '{"schedules":[],"calendar":{"weekdays":[],"overrides":[]}}',
    });

    await expect(periodName(page)).toHaveText("No schedule yet");

    // The empty state links INTO the editor rather than creating something
    // on the user's behalf; the panel it lands on says what to press next.
    await page.getByRole("button", { name: "Set up a schedule" }).click();
    await expect(page.locator("#panel-schedules")).toBeVisible();
    await expect(page.locator("#panel-schedules")).toContainText("There are no schedules");

    await page.locator("#schedule-new").click();
    await expect(chips(page)).toHaveCount(1);
    await expect(chips(page)).toHaveText("New schedule");

    await page.locator("#schedule-name-input").fill("My day");
    await page.locator("#add-period").click();

    const row = page.locator("#period-editor .editrow").first();
    await row.locator('[data-field="name"]').fill("Homeroom");
    await row.locator('[data-field="start"]').fill("09:00");
    await row.locator('[data-field="length"]').fill("60");

    await page.locator("#tab-calendar").click();
    await page.locator("#today-schedule").selectOption({ label: "My day" });
    await expect(page.locator("#calendar-today")).toContainText("it runs My day");

    await backToCountdown(page);
    await expect(scheduleName(page)).toHaveText("My day");
    await expect(periodName(page)).toHaveText("Homeroom");
  });

  /**
   * Deleting the last schedule is legal, and lands back on the onboarding
   * screen rather than on anything broken.
   */
  test("the library can be emptied, and says so", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");

    for (let remaining = 4; remaining > 0; remaining--) {
      await expect(chips(page)).toHaveCount(remaining);
      await page.locator("#schedule-delete").click();
      await page.locator("#confirm-ok").click();
    }

    await expect(chips(page)).toHaveCount(0);
    await expect(page.locator("#schedule-delete")).toBeDisabled();
    await expect(page.locator("#panel-schedules")).toContainText("There are no schedules");

    await backToCountdown(page);
    await expect(periodName(page)).toHaveText("No schedule yet");
  });
});

/**
 * The Phase 4 review's two silent no-ops, from the browser side.
 *
 * The unit suite proves `setOverride` refuses both cases. What only a browser
 * can show is the other half of the fix: that the form SAYS SO, rather than
 * accepting a click and quietly doing nothing.
 */
test.describe("the exception form refuses out loud", () => {
  /**
   * A calendar sitting exactly on `SCHEDULE_LIMITS.overrides`.
   *
   * Planted through storage rather than clicked in, for the obvious reason. The
   * dates are all in 2000 and 2001, so the fixture's own Wednesday is not one of
   * them - which is what puts the Today control in its blocked state.
   */
  const fullCalendar = () => {
    const overrides = [];
    for (let n = 0; n < 400; n++) {
      const year = 2000 + Math.floor(n / (28 * 12));
      const month = String((Math.floor(n / 28) % 12) + 1).padStart(2, "0");
      const day = String((n % 28) + 1).padStart(2, "0");
      overrides.push({ date: `${year}-${month}-${day}`, scheduleId: "regular" });
    }

    return JSON.stringify({
      schedules: [
        {
          id: "regular",
          name: "Regular",
          periods: [{ name: "Period 1", kind: "class", startMin: 480, endMin: 600 }],
        },
      ],
      calendar: {
        weekdays: [null, "regular", "regular", "regular", "regular", "regular", null],
        overrides,
      },
    });
  };

  /**
   * Chrome's date input accepts years past four digits, so a typo of 20260 for
   * 2026 is a value the CONTROL considers valid and `parseIsoDate` does not.
   * Before the fix this reached `setOverride`, was dropped by `parseCalendar`,
   * and cleared the field - a click that emptied the form and changed nothing.
   */
  test("a five-digit year is named, not swallowed", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "calendar");

    const date = page.locator("#override-date");
    await date.fill("20260-09-14");
    await expect(date).toHaveValue("20260-09-14");

    await expect(page.locator("#override-add")).toBeDisabled();
    await expect(page.locator("#override-date-error")).toBeVisible();
    await expect(date).toHaveAttribute("aria-invalid", "true");
    await expect(date).toHaveAttribute("aria-describedby", "override-date-error");

    // Drawn, not only announced. The rule that paints `aria-invalid` lost on
    // specificity to the control skin's `border` shorthand for two whole
    // phases, so this measures the computed colour rather than the attribute.
    const danger = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--danger").trim(),
    );
    const value = Number.parseInt(danger.replace("#", ""), 16);
    await expect(date).toHaveCSS(
      "border-top-color",
      `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`,
    );

    // And correcting it clears the error rather than needing the field emptied.
    await date.fill("2026-09-14");
    await expect(page.locator("#override-date-error")).toHaveCount(0);
    await expect(page.locator("#override-add")).toBeEnabled();

    await page.locator("#override-add").click();
    await expect(page.locator("#overrides li")).toHaveCount(1);
  });

  test("a full calendar blocks the controls that would grow it, and says why", async ({ page }) => {
    await openApp(page, MID_PERIOD, { storage: fullCalendar() });
    await openSettings(page, "calendar");

    // The Today control writes an override, and today has none - so every option
    // that would change anything is refused.
    await expect(page.locator("#today-schedule")).toBeDisabled();
    await expect(page.locator("#today-full")).toBeVisible();

    // A NEW date cannot be added.
    await page.locator("#override-date").fill("2099-12-25");
    await expect(page.locator("#override-add")).toBeDisabled();
    await expect(page.locator("#calendar-full")).toBeVisible();

    // A date that is already listed CAN still be corrected - replacing does not
    // grow the calendar, and the gate that refused it was wrong.
    await page.locator("#override-date").fill("2000-01-01");
    await expect(page.locator("#override-add")).toBeEnabled();
    await expect(page.locator("#calendar-full")).toHaveCount(0);

    await page.locator("#override-schedule").selectOption({ label: "No school" });
    await page.locator("#override-add").click();

    const first = page.locator("#overrides li").first();
    await expect(first).toContainText("2000-01-01");
    await expect(first).toContainText("No school");
  });

  test("removing one is the way back under the cap", async ({ page }) => {
    await openApp(page, MID_PERIOD, { storage: fullCalendar() });
    await openSettings(page, "calendar");

    await expect(page.locator("#today-schedule")).toBeDisabled();

    await page.locator("#overrides li button").first().click();

    await expect(page.locator("#today-schedule")).toBeEnabled();
    await expect(page.locator("#today-full")).toHaveCount(0);

    await page.locator("#today-schedule").selectOption({ label: "Regular" });
    await expect(page.locator("#calendar-today")).toContainText("it runs Regular");
  });
});

test.describe("past exceptions", () => {
  test("can be removed at once, keeping today's and the future's", async ({ page }) => {
    // The fixture is Wednesday 2026-09-02. Three exceptions: one long past, one
    // for today, one next month - and the cap is 400 with nothing pruning, so
    // two years in this list is mostly dates that can never resolve again.
    await openApp(page, MID_PERIOD, {
      storage: JSON.stringify({
        schedules: [
          {
            id: "regular",
            name: "Regular",
            periods: [{ name: "Period 1", kind: "Class", startMin: 480, endMin: 600 }],
          },
        ],
        calendar: {
          weekdays: [null, "regular", "regular", "regular", "regular", "regular", null],
          overrides: [
            { date: "2025-01-15", scheduleId: null },
            { date: "2026-09-02", scheduleId: "regular" },
            { date: "2026-10-01", scheduleId: null },
          ],
        },
      }),
    });
    await openSettings(page, "calendar");

    await expect(page.locator("#overrides li")).toHaveCount(3);
    await expect(page.locator("#past-overrides")).toContainText("One of these is in the past");

    await page.locator("#prune-overrides").click();

    await expect(page.locator("#overrides li")).toHaveCount(2);
    await expect(page.locator("#overrides li").first()).toContainText("2026-09-02");
    await expect(page.locator("#past-overrides")).toHaveCount(0);
  });
});

test.describe("the weekend's second way out", () => {
  test("lands a keyboard user on the weekday defaults, not the top of the panel", async ({
    page,
  }) => {
    // The primary action writes a one-off exception, which is right for a
    // snow day and wrong for somebody whose Saturday genuinely runs school.
    // The second route opens the same panel with focus on the section that
    // answers that - so the next Tab is the first weekday select.
    await openApp(page, WEEKEND);

    await page.locator("#message-secondary").click();

    await expect(page.locator("#panel-calendar")).toBeVisible();
    await expect(page.locator("#weekday-defaults")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#weekday-map select").first()).toBeFocused();
  });
});
