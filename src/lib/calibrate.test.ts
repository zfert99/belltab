import { describe, expect, it } from "vitest";
import { calibrateOffset } from "./calibrate";
import { parseSchedule } from "./parse";
import { DEFAULT_SCHEDULES, type ValidSchedule } from "./schedule";

/**
 * Against the seeded Regular day: Period 2 is 09:05-10:05 and Passing
 * 10:05-10:10, so 10:05:00 is a bell (36300s) and so is 10:10:00 (36600s).
 */
const regular = (() => {
  const result = parseSchedule(DEFAULT_SCHEDULES[0]);
  if (!result.ok) throw new Error("seed does not parse");
  return result.value;
})();

const empty = (() => {
  const result = parseSchedule({ id: "e", name: "Empty", periods: [] });
  if (!result.ok) throw new Error("empty does not parse");
  return result.value as ValidSchedule;
})();

const at = (h: number, m: number, s = 0) => h * 3600 + m * 60 + s;

describe("calibrateOffset", () => {
  it("is zero when the button is pressed exactly on the bell", () => {
    expect(calibrateOffset(regular, at(10, 5), 300)).toBe(0);
  });

  it("is positive when the device is behind the bell - the countdown must run ahead", () => {
    // The real bell rang; the device still says 10:04:48. Twelve seconds have
    // to be ADDED to the device for the countdown to have reached zero.
    expect(calibrateOffset(regular, at(10, 4, 48), 300)).toBe(12);
  });

  it("is negative when the device is ahead of the bell", () => {
    expect(calibrateOffset(regular, at(10, 5, 12), 300)).toBe(-12);
  });

  it("picks the nearest bell when two are close", () => {
    // 10:07:30 is 150s past the 10:05 bell and 150s before the 10:10 one;
    // 10:07:31 is nearer the later one.
    expect(calibrateOffset(regular, at(10, 7, 31), 300)).toBe(149);
    expect(calibrateOffset(regular, at(10, 7, 29), 300)).toBe(-149);
  });

  it("counts a period's end as a bell even when a gap follows", () => {
    // The seeded Half day ends at 12:00 with nothing after it.
    const half = parseSchedule(DEFAULT_SCHEDULES[2]);
    if (!half.ok) throw new Error("half day does not parse");
    const lastEnd = half.value.periods[half.value.periods.length - 1].endMin * 60;

    expect(calibrateOffset(half.value, lastEnd + 5, 300)).toBe(-5);
  });

  it("refuses when no bell is within the offset's cap", () => {
    // 09:30 is 25 minutes from either neighbour. A press here is a mistake,
    // not a measurement, and must not become five minutes of "correction".
    expect(calibrateOffset(regular, at(9, 30), 300)).toBeNull();
  });

  it("accepts exactly the cap and refuses one second past it", () => {
    expect(calibrateOffset(regular, at(10, 0, 0), 300)).toBe(300);
    expect(calibrateOffset(regular, at(9, 59, 59), 300)).toBeNull();
  });

  it("has nothing to measure against on an empty schedule", () => {
    expect(calibrateOffset(empty, at(10, 5), 300)).toBeNull();
  });

  it("never returns negative zero", () => {
    expect(Object.is(calibrateOffset(regular, at(10, 5), 300), -0)).toBe(false);
  });
});
