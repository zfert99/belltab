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
 */
test("PROBE: what the date control reports for a typed February 30th", async ({
  page,
}, testInfo) => {
  await openApp(page, MID_PERIOD);
  await openSettings(page, "calendar");

  const input = page.locator("#override-date");

  const read = () =>
    input.evaluate((element: HTMLInputElement) => ({
      value: element.value,
      type: element.type,
      badInput: element.validity.badInput,
      valid: element.validity.valid,
      valueMissing: element.validity.valueMissing,
    }));

  const readings: Record<string, unknown> = {
    engine: testInfo.project.name,
    beforeTyping: await read(),
  };

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

  // Does the error element the test looks for exist at this point?
  readings.errorElementCount = await page.locator("#override-date-error").count();
  readings.errorText = await page
    .locator("#override-date-error")
    .textContent()
    .catch(() => null);
  readings.addDisabled = await page.locator("#override-add").isDisabled();

  // The comparison case the original measurement used: a programmatic set.
  await input.fill("2026-02-30");
  readings.afterProgrammaticFill = await read();

  console.log(`PROBE_RESULT ${JSON.stringify(readings, null, 2)}`);
});
