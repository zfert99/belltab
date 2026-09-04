import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  openApp,
  openSettings,
  AFTER_SCHOOL,
  BEFORE_SCHOOL,
  MID_PERIOD,
  WEEKEND,
} from "./helpers";

/**
 * The automated accessibility scan, owed since 2026-08-27.
 *
 * `Docs/research/accessibility-responsive-qa.md` recommends `@axe-core/playwright`
 * on every journey with zero critical or serious violations to release, and is
 * explicit that the gates this repo already had are NOT the same thing:
 * `eslint-plugin-jsx-a11y` reads source and cannot see a rendered contrast
 * ratio, a duplicated id, or an `aria-controls` pointing at an element that is
 * not there; the reflow gate measures layout; the live-region enumeration
 * checks three ids by name.
 *
 * What axe adds is the rendered document, which is where several of this repo's
 * actual defects have lived. It is still not a substitute for using the thing
 * with a screen reader - axe catches roughly a third of WCAG issues by most
 * counts, and every judgement call in this app (whether the tab title should
 * announce, whether the countdown should be live) is in the other two thirds.
 *
 * Scanned at the default viewport. Small-screen layout is the reflow gate's
 * job, and running every journey at five widths here would quintuple the cost
 * to re-check rules that do not depend on width.
 */

/** The tags that correspond to something a person is actually entitled to. */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * The release bar from the research document.
 *
 * `moderate` and `minor` findings are reported in the failure message but do not
 * fail the run, which is a deliberate line and not an oversight: axe's own
 * impact ratings are what the recommendation is written against, and a gate that
 * fails on `minor` is a gate people start skipping.
 */
const BLOCKING = new Set(["critical", "serious"]);

async function expectNoSeriousViolations(page: Page, journey: string): Promise<void> {
  /*
    THE CLOCK HAS TO BE RUNNING, or axe never returns.

    Every other suite in this repo runs on a clock paused by `openApp`, because
    the app resolves which schedule is running from the device clock and a real
    one would make these tests pass on a Wednesday morning and fail on a
    Saturday night. Axe does not survive that: it schedules its own work through
    `setTimeout` and `requestAnimationFrame`, and against a paused clock those
    callbacks never fire, so `analyze()` hangs until Playwright's timeout. The
    first run of this file was ten identical 30-second timeouts inside
    `frame.evaluate`, with no violations reported and nothing wrong with the
    page.

    `resume()` restarts the flow of time WITHOUT moving it: the fixture's date
    and hour still stand, so the schedule that was resolved stays resolved and
    the screen under test is the one the journey set up. The countdown then
    ticks during the scan, which costs nothing here - this file asserts about
    markup, never about a number.
  */
  await page.clock.resume();

  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();

  const describe = (impact: string) =>
    violations
      .filter((violation) => violation.impact === impact)
      .map(
        (violation) =>
          `${violation.id} (${violation.nodes.length}x): ${violation.help}\n      ` +
          violation.nodes
            .slice(0, 3)
            .map((node) => node.target.join(" "))
            .join("\n      "),
      );

  const blocking = [...BLOCKING].flatMap(describe);
  const rest = ["moderate", "minor"].flatMap(describe);

  expect(
    blocking,
    `${journey}: critical/serious accessibility violations.\n` +
      `${blocking.join("\n")}\n` +
      (rest.length > 0 ? `\nAlso present (not blocking):\n${rest.join("\n")}` : ""),
  ).toEqual([]);
}

test.describe("the countdown", () => {
  for (const [journey, at] of [
    ["mid-period", MID_PERIOD],
    ["before school", BEFORE_SCHOOL],
    ["after school", AFTER_SCHOOL],
    ["the weekend, with its call to action", WEEKEND],
  ]) {
    test(`has no serious violations (${journey})`, async ({ page }) => {
      await openApp(page, at);
      await expectNoSeriousViolations(page, journey);
    });
  }

  test("has no serious violations (the Day view)", async ({ page }) => {
    // Eleven rows, one `aria-current="time"`, a disclosure with
    // `aria-expanded`, and a decorative track - the list's whole accessible
    // contract, scanned in one pass with the past rows revealed.
    await openApp(page, MID_PERIOD);
    await page.locator("#view-day").click();
    await expect(page.locator("#day-view")).toBeVisible();
    await page.locator("#past-toggle").click();
    await expectNoSeriousViolations(page, "the Day view");
  });

  test("has none on the onboarding screen either", async ({ page }) => {
    await openApp(page, MID_PERIOD, {
      storage: '{"schedules":[],"calendar":{"weekdays":[],"overrides":[]}}',
    });
    await expectNoSeriousViolations(page, "onboarding");
  });
});

test.describe("big mode", () => {
  /**
   * The projector, which is the one screen in the app that changes what is on
   * it purely with CSS. `display: none` on the header controls takes them out
   * of the accessibility tree as well, which is correct here - but it also
   * means axe is scanning a genuinely different document, not the same one at a
   * different size.
   */
  test("has no serious violations", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await page.locator("#view-big").click();
    await expect(page.locator("#big-exit")).toBeVisible();

    await expectNoSeriousViolations(page, "big mode");
  });
});

test.describe("settings", () => {
  test("the schedules panel has no serious violations", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");
    await expectNoSeriousViolations(page, "settings/schedules");
  });

  /**
   * The editor mid-error is the state worth scanning most.
   *
   * Every `aria-invalid`, every `aria-describedby` and the one live region only
   * exist while something is wrong, so a scan of the clean form never sees the
   * markup that carries them.
   */
  test("the editor showing an overlap error has no serious violations", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");

    await page
      .locator("#period-editor .editrow")
      .nth(2)
      .locator('[data-field="start"]')
      .fill("08:30");
    await expect(page.locator("#period-editor .editrow").nth(2).locator(".editrow__error")).toBeVisible();

    await expectNoSeriousViolations(page, "settings/schedules, overlap error");
  });

  test("the calendar panel has no serious violations", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "calendar");
    await expectNoSeriousViolations(page, "settings/calendar");
  });

  test("the calendar panel showing a date error has no serious violations", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "calendar");

    await page.locator("#override-date").fill("20260-09-14");
    await expect(page.locator("#override-date-error")).toBeVisible();

    await expectNoSeriousViolations(page, "settings/calendar, date error");
  });

  /**
   * The preferences panel, whose three controls are shapes nothing else in the
   * app uses: a radio group, a checkbox that can be disabled by the engine
   * rather than by the app, and a number field with an error bound to it.
   *
   * The disabled case is worth naming: a control the browser cannot honour is
   * dimmed rather than removed, which puts a deliberately low-contrast label on
   * screen. axe checks contrast on disabled controls too, and the exemption
   * that makes it pass is one this suite should be made to state out loud if it
   * ever stops passing.
   */
  test("the preferences panel has no serious violations", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");
    await expectNoSeriousViolations(page, "settings/preferences");
  });

  test("the preferences panel showing an offset error has no serious violations", async ({
    page,
  }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    await page.locator("#bell-offset").fill("9000");
    await expect(page.locator("#bell-offset-error")).toContainText("whole number of seconds");

    await expectNoSeriousViolations(page, "settings/preferences, offset error");
  });

  /**
   * The modal, which is the one place this app changes what the rest of the
   * page is. `showModal()` makes the background inert, and axe scans the whole
   * document - so this is also a check that the inert half is not being
   * reported as a wall of unreachable controls.
   */
  test("the delete confirmation has no serious violations", async ({ page }) => {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "schedules");

    await page.locator("#schedule-delete").click();
    await expect(page.locator("#confirm-dialog")).toBeVisible();

    await expectNoSeriousViolations(page, "the confirm dialog");
  });
});

/**
 * The three densest panels again, at the reflow floor.
 *
 * The sweep above runs at the default viewport because small-screen LAYOUT is
 * the reflow gate's job - but layout and accessibility are not the same check.
 * The editor stacks into a different DOM shape below 34rem, labels that were
 * visually hidden become visible, and touch targets shrink with the columns;
 * none of that is exercised by a 1280px axe run. Three journeys at 320px is
 * the cheapest honest answer to "is it still clean when it has reflowed".
 */
test.describe("at 320 CSS px", () => {
  test.use({ viewport: { width: 320, height: 800 } });

  for (const panel of ["schedules", "calendar", "preferences"] as const) {
    test(`the ${panel} panel has no serious violations`, async ({ page }) => {
      await openApp(page, MID_PERIOD);
      await openSettings(page, panel);
      await expectNoSeriousViolations(page, `settings/${panel} at 320px`);
    });
  }
});
