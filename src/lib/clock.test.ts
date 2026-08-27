import { describe, expect, it } from "vitest";
import { localIsoDate, localNow, secondsSinceMidnight } from "./clock";

/**
 * The clock reader, which is the only part of `src/lib/` that touches `Date`.
 *
 * The suite runs pinned to America/New_York (see vitest.config.ts) so that
 * local and UTC genuinely disagree. Without a pinned zone the UTC-versus-local
 * cases below would pass on a laptop in New York and silently assert nothing on
 * a UTC CI runner - which is exactly the failure the E2E helpers document.
 *
 * Dates are built with the LOCAL constructor - `new Date(2026, 8, 2, 9, 30)` -
 * rather than parsed from a string, so each fixture names the wall-clock time
 * it is about.
 */

describe("secondsSinceMidnight", () => {
  it("is zero at local midnight", () => {
    expect(secondsSinceMidnight(new Date(2026, 8, 2, 0, 0, 0))).toBe(0);
  });

  it("counts hours, minutes and seconds", () => {
    // 09:30:15 -> 9*3600 + 30*60 + 15
    expect(secondsSinceMidnight(new Date(2026, 8, 2, 9, 30, 15))).toBe(34_215);
  });

  it("is 86399 in the last second of the day", () => {
    expect(secondsSinceMidnight(new Date(2026, 8, 2, 23, 59, 59))).toBe(86_399);
  });

  it("floors milliseconds away rather than rounding them up", () => {
    // Rounding would let the display reach a period's end boundary half a
    // second before the bell does.
    expect(secondsSinceMidnight(new Date(2026, 8, 2, 9, 30, 15, 999))).toBe(34_215);
  });

  it("reads the wall clock, not elapsed time, across the spring DST gap", () => {
    // 8 March 2026, 02:00 EST -> 03:00 EDT. The local day is 23 hours long, so
    // epoch arithmetic from local midnight would report 10:00 as 9 hours in.
    // The bells do not care: 10:00 is 10:00.
    expect(secondsSinceMidnight(new Date(2026, 2, 8, 10, 0, 0))).toBe(36_000);
  });

  it("reads the wall clock across the autumn DST repeat", () => {
    // 1 November 2026: 01:00-02:00 happens twice. Both readings are 01:30 on
    // the wall and both must answer 5400 - a 25-hour day would otherwise push
    // every afternoon period an hour out.
    const beforeFallBack = new Date(Date.UTC(2026, 10, 1, 5, 30)); // 01:30 EDT
    const afterFallBack = new Date(Date.UTC(2026, 10, 1, 6, 30)); // 01:30 EST

    expect(secondsSinceMidnight(beforeFallBack)).toBe(5_400);
    expect(secondsSinceMidnight(afterFallBack)).toBe(5_400);
  });
});

describe("localIsoDate", () => {
  it("zero-pads the month and the day", () => {
    expect(localIsoDate(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05");
  });

  it("names the local day, not the UTC one, late in the evening", () => {
    // 2 September 2026, 23:00 EDT is already 3 September in UTC, so
    // toISOString().slice(0, 10) would point the calendar at tomorrow.
    expect(localIsoDate(new Date(2026, 8, 2, 23, 0))).toBe("2026-09-02");
  });
});

describe("localNow", () => {
  it("returns the second, the date and the weekday from one reading", () => {
    // 2 September 2026 is a Wednesday: getDay() === 3, which indexes
    // Calendar.weekdays directly.
    expect(localNow(new Date(2026, 8, 2, 9, 30, 0))).toEqual({
      secOfDay: 34_200,
      isoDate: "2026-09-02",
      weekday: 3,
    });
  });

  it("keeps the date and the second on the same side of midnight", () => {
    expect(localNow(new Date(2026, 8, 2, 23, 59, 59))).toEqual({
      secOfDay: 86_399,
      isoDate: "2026-09-02",
      weekday: 3,
    });
    expect(localNow(new Date(2026, 8, 3, 0, 0, 0))).toEqual({
      secOfDay: 0,
      isoDate: "2026-09-03",
      weekday: 4,
    });
  });
});
