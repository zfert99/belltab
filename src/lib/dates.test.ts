import { describe, expect, it } from "vitest";
import { weekdayOf } from "./dates";

/**
 * Pinned against dates whose weekday is known independently: the E2E fixtures
 * (a Wednesday and a Saturday in September 2026, which helpers.ts documents),
 * a leap day, and the two edges of a year.
 */
describe("weekdayOf", () => {
  it.each([
    ["2026-09-02", "Wed"],
    ["2026-09-05", "Sat"],
    ["2026-09-14", "Mon"],
    ["2024-02-29", "Thu"],
    ["2024-03-01", "Fri"],
    ["2026-01-01", "Thu"],
    ["2025-12-31", "Wed"],
    ["2000-02-29", "Tue"],
    ["1970-01-01", "Thu"],
  ])("%s is a %s", (date, expected) => {
    expect(weekdayOf(date)).toBe(expected);
  });

  it("does not depend on the device timezone", () => {
    // The trap this function exists to avoid: `new Date("2026-09-14")` is UTC
    // midnight, which is still Sunday evening in New York. The string-only
    // arithmetic cannot see a timezone at all, so this holds wherever it runs.
    expect(weekdayOf("2026-09-14")).toBe("Mon");
  });

  it.each(["2026-9-14", "14/09/2026", "2026-13-01", "2026-00-10", "2026-09-32", "", "tomorrow"])(
    "returns null for %j",
    (value) => {
      expect(weekdayOf(value)).toBeNull();
    },
  );
});
