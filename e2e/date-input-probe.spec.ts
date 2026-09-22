import { test } from "@playwright/test";
import { openApp, openSettings, MID_PERIOD } from "./helpers";

/**
 * TEMPORARY. Delete once Docs/research/webkit-date-input-validity.md records
 * its readings.
 *
 * This asserts nothing. It exists to answer one question that cannot be
 * answered from a development machine: what does the LINUX CI WebKit build
 * report for `<input type="date">` when a person types February 30th into it?
 *
 * The question matters because `CalendarPanel` tells "typed nonsense" apart
 * from "empty box" using `validity.badInput`, and the nightly three-engine run
 * has been red on WebKit since 2026-09-08 with the error element absent
 * entirely - which means neither `badInput` nor the parse path fired. The two
 * candidate explanations need different fixes, and the build log's own
 * 2026-09-01 entry warns that the dev build and this one disagree about
 * whether these controls exist at all.
 *
 * Two lessons from the first attempt, both encoded below. `locator.fill()`
 * REFUSES an impossible date on a real date control - "Malformed value", before
 * the browser ever sees it - so the programmatic comparison goes through
 * `evaluate`. And `textContent()` on a locator matching nothing waits out the
 * whole test timeout, which on WebKit is exactly the case being measured; every
 * read here is therefore count-guarded, and the readings print from a `finally`
 * so a throw anywhere still yields data.
 */
test("PROBE: what the date control reports for a typed February 30th", async ({
  page,
}, testInfo) => {
  const readings: Record<string, unknown> = { engine: testInfo.project.name };

  try {
    await openApp(page, MID_PERIOD);
    await openSettings(page, "calendar");

    const input = page.locator("#override-date");
    const error = page.locator("#override-date-error");

    const read = () =>
      input.evaluate((element: HTMLInputElement) => ({
        value: element.value,
        type: element.type,
        badInput: element.validity.badInput,
        valid: element.validity.valid,
      }));

    // Does the engine implement the control at all, or hand back a text box?
    readings.beforeTyping = await read();

    // One character at a time, reading after each: if the control clamps an
    // impossible day, or swallows a digit, the step it happens on is the answer.
    await input.click();
    const perKeystroke: unknown[] = [];
    for (const character of "02302026") {
      await page.keyboard.press(character);
      perKeystroke.push({ character, ...(await read()) });
    }
    readings.perKeystroke = perKeystroke;

    await page.keyboard.press("Tab");
    readings.afterTab = await read();
    readings.activeElementAfterTab = await page.evaluate(
      () => document.activeElement?.id || document.activeElement?.tagName || null,
    );

    // Count FIRST. A zero-match locator makes textContent() wait out the test.
    readings.errorElementCount = await error.count();
    readings.errorText =
      (await error.count()) > 0 ? ((await error.textContent()) ?? "").trim() : null;
    readings.addDisabled = await page.locator("#override-add").isDisabled();

    // The instrument the original B7 measurement used and called wrong: a
    // programmatic set, which bypasses the segmented control entirely.
    readings.afterProgrammaticSet = await input.evaluate((element: HTMLInputElement) => {
      element.value = "2026-02-30";
      return {
        value: element.value,
        type: element.type,
        badInput: element.validity.badInput,
        valid: element.validity.valid,
      };
    });
  } catch (error) {
    readings.threw = error instanceof Error ? error.message : String(error);
  } finally {
    console.log(`PROBE_RESULT ${JSON.stringify(readings)}`);
  }
});
