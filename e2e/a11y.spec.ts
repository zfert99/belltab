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

  test("has none on the onboarding screen either", async ({ page }) => {
    await openApp(page, MID_PERIOD, {
      storage: '{"schedules":[],"calendar":{"weekdays":[],"overrides":[]}}',
    });
    await expectNoSeriousViolations(page, "onboarding");
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
