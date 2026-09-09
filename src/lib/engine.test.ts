import { describe, it, expect } from "vitest";
import { stateAt, daySummaryAt, periodStatusAt, blockPositionAt, crossedBell } from "./engine";
import { parseSchedule } from "./parse";
import { DEFAULT_SCHEDULES, type ValidSchedule } from "./schedule";

/**
 * Fixtures go through the real parser rather than being cast into place.
 *
 * The engine only accepts a `ValidSchedule`, and the honest way to obtain one
 * is the boundary. Casting instead would let a fixture that violates the
 * engine's own invariants - unsorted, overlapping - into these tests, which is
 * exactly the class of bug the brand exists to prevent.
 */
function valid(input: unknown): ValidSchedule {
  const result = parseSchedule(input);
  if (!result.ok) throw new Error(`fixture is not a schedule: ${JSON.stringify(result.errors)}`);
  return result.value;
}

const regular = valid(DEFAULT_SCHEDULES[0]);

/** Seconds since local midnight. No fake timers anywhere in this file: the
 *  engine takes the current time as an argument, so there is no clock to fake. */
const at = (hours: number, minutes: number, seconds = 0) => hours * 3600 + minutes * 60 + seconds;

const EMPTY = valid({ name: "None", periods: [] });
const SOLO = valid({
  name: "Solo",
  periods: [{ name: "Only", kind: "class", startMin: 600, endMin: 660 }],
});
const GAPPY = valid({
  name: "Gappy",
  periods: [
    { name: "A", kind: "class", startMin: 480, endMin: 540 },
    { name: "B", kind: "class", startMin: 600, endMin: 660 },
  ],
});

describe("stateAt", () => {
  it("counts down to the first bell before school", () => {
    const state = stateAt(regular, at(7, 59, 59));
    expect(state.phase).toBe("before");
    expect(state.current).toBeNull();
    expect(state.next?.name).toBe("Period 1");
    expect(state.remainingSec).toBe(1);
  });

  it("is inside Period 1 at exactly 8:00:00", () => {
    const state = stateAt(regular, at(8, 0, 0));
    expect(state.phase).toBe("during");
    expect(state.current?.name).toBe("Period 1");
    expect(state.remainingSec).toBe(55 * 60);
    expect(state.progress).toBe(0);
  });

  it("is still inside Period 1 one second before it ends", () => {
    const state = stateAt(regular, at(8, 54, 59));
    expect(state.current?.name).toBe("Period 1");
    expect(state.remainingSec).toBe(1);
  });

  // The boundary that matters most: with <= on both ends, two back-to-back
  // periods both claim this second and the display flickers between them.
  it("hands off to the next period at exactly the bell", () => {
    const state = stateAt(regular, at(8, 55, 0));
    expect(state.current?.name).toBe("Passing");
    expect(state.next?.name).toBe("Period 2");
    expect(state.progress).toBe(0);
  });

  it("has no next period during the last one", () => {
    const state = stateAt(regular, at(14, 29, 59));
    expect(state.current?.name).toBe("Period 6");
    expect(state.next).toBeNull();
  });

  it("is over at exactly the last bell", () => {
    const state = stateAt(regular, at(14, 30, 0));
    expect(state.phase).toBe("after");
    expect(state.current).toBeNull();
    expect(state.progress).toBe(1);
  });

  it("reports a gap in a schedule that does not tile the day", () => {
    const state = stateAt(GAPPY, at(9, 30));
    expect(state.phase).toBe("gap");
    expect(state.current).toBeNull();
    expect(state.next?.name).toBe("B");
    expect(state.remainingSec).toBe(1800);
    expect(state.progress).toBeCloseTo(0.5);
  });

  it("handles an empty schedule without throwing", () => {
    expect(stateAt(EMPTY, at(10, 0)).phase).toBe("empty");
  });

  it("handles a single-period schedule", () => {
    const state = stateAt(SOLO, at(10, 30));
    expect(state.remainingSec).toBe(1800);
    expect(state.next).toBeNull();
  });

  // No rollover code exists, and none is needed: nowSec goes 86399 -> 0 and
  // the phase falls out of the same comparisons.
  it("crosses midnight without special handling", () => {
    expect(stateAt(regular, at(23, 59, 59)).phase).toBe("after");
    expect(stateAt(regular, at(0, 0, 0)).phase).toBe("before");
  });

  /**
   * The union is the type-level version of the five empty states, and it is
   * only worth anything if the runtime agrees with it: a `during` with a null
   * `current` would type-check at every call site and crash at one.
   */
  it("never contradicts the shape its phase promises", () => {
    for (let second = 0; second < 86400; second += 13) {
      const state = stateAt(regular, second);

      if (state.phase === "during") expect(state.current).not.toBeNull();
      else expect(state.current).toBeNull();

      if (state.phase === "before" || state.phase === "gap") expect(state.next).not.toBeNull();
      if (state.phase === "after" || state.phase === "empty") expect(state.next).toBeNull();

      expect(state.remainingSec).toBeGreaterThanOrEqual(0);
      expect(state.progress).toBeGreaterThanOrEqual(0);
      expect(state.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe("periodStatusAt", () => {
  const period2 = regular.periods[2]; // 9:05 - 10:05

  it("uses the same half-open rule as stateAt", () => {
    expect(periodStatusAt(period2, at(9, 4, 59))).toBe("future");
    expect(periodStatusAt(period2, at(9, 5, 0))).toBe("current");
    expect(periodStatusAt(period2, at(10, 4, 59))).toBe("current");
    expect(periodStatusAt(period2, at(10, 5, 0))).toBe("past");
  });

  // If the list and the countdown ever disagreed about which period is running,
  // this is the assertion that would have caught it.
  it("never marks two periods current at the same second", () => {
    for (let second = 0; second < 86400; second += 7) {
      const current = regular.periods.filter((p) => periodStatusAt(p, second) === "current");
      expect(current.length).toBeLessThanOrEqual(1);
    }
  });

  it("leaves no second of the school day unaccounted for", () => {
    for (let second = at(8, 0); second < at(14, 30); second += 11) {
      const current = regular.periods.filter((p) => periodStatusAt(p, second) === "current");
      expect(current).toHaveLength(1);
    }
  });
});

describe("daySummaryAt", () => {
  it("spans first bell to last bell", () => {
    expect(daySummaryAt(regular, at(8, 0)).remainingSec).toBe(390 * 60);
    expect(daySummaryAt(regular, at(11, 15)).progress).toBeCloseTo(0.5);
  });

  it("counts the whole day, holes included", () => {
    const day = daySummaryAt(GAPPY, at(9, 30));
    expect(day.phase).toBe("during");
    expect(day.remainingSec).toBe(5400);
    expect(day.progress).toBeCloseTo(0.5);
  });

  it("is before school at midnight and after it at the last bell", () => {
    expect(daySummaryAt(regular, at(0, 0)).phase).toBe("before");
    expect(daySummaryAt(regular, at(14, 30)).phase).toBe("after");
  });

  it("handles an empty schedule", () => {
    expect(daySummaryAt(EMPTY, at(10, 0)).phase).toBe("empty");
  });
});
describe("blockPositionAt", () => {
  it("excludes passing periods from the count", () => {
    expect(blockPositionAt(regular, at(10, 0)).total).toBe(7);
  });

  it("counts blocks that have started, not blocks finished", () => {
    expect(blockPositionAt(regular, at(7, 0)).index).toBe(0);
    expect(blockPositionAt(regular, at(8, 0)).index).toBe(1);
    expect(blockPositionAt(regular, at(9, 5)).index).toBe(2);
  });

  // Mid-passing the number holds at the block just finished rather than
  // jumping ahead to one that has not begun.
  it("holds steady while in a passing period", () => {
    expect(blockPositionAt(regular, at(8, 57)).index).toBe(1);
  });

  it("counts lunch as a block", () => {
    expect(blockPositionAt(regular, at(11, 5)).index).toBe(4);
  });

  it("reaches the total after the last bell", () => {
    expect(blockPositionAt(regular, at(14, 30))).toEqual({ index: 7, total: 7 });
  });
});

describe("crossedBell", () => {
  /**
   * What a bell IS: the clock crossing a period's start or end. Regular's
   * Period 2 runs 09:05-10:05 (33300-36300s); Passing follows to 10:10.
   */
  const regular = (() => {
    const parsed = parseSchedule(DEFAULT_SCHEDULES[0]);
    if (!parsed.ok) throw new Error("seed must parse");
    return parsed.value;
  })();
  const PERIOD_2_ENDS = 10 * 3600 + 5 * 60;

  it("is false for the same second read twice", () => {
    expect(crossedBell(regular, 34000, 34000)).toBe(false);
  });

  it("is false for a tick inside a period", () => {
    expect(crossedBell(regular, 34000, 34001)).toBe(false);
  });

  it("is true for the tick that lands exactly on a boundary - half-open, like stateAt", () => {
    expect(crossedBell(regular, PERIOD_2_ENDS - 1, PERIOD_2_ENDS)).toBe(true);
  });

  it("is false for the tick just after it", () => {
    expect(crossedBell(regular, PERIOD_2_ENDS, PERIOD_2_ENDS + 1)).toBe(false);
  });

  it("counts a slept-through stretch as one crossing, however many bells it spans", () => {
    // 09:30 to 10:11 spans Passing's start and end and Period 3's start.
    expect(crossedBell(regular, 34200, 36660)).toBe(true);
  });

  it("is never true backwards - the same second, or a new day", () => {
    expect(crossedBell(regular, 36300, 36299)).toBe(false);
    // Midnight: "after" at 86399 to "before" at 0 is a date change, not a bell.
    expect(crossedBell(regular, 86399, 0)).toBe(false);
  });

  it("does not care that the schedule was edited, only where the clock went", () => {
    // The running period's end moved from 10:05 to 10:04 while the clock sat
    // at 10:04:30: no second was crossed, so no bell - the whole reason this
    // function exists.
    const edited = parseSchedule({
      ...DEFAULT_SCHEDULES[0],
      periods: DEFAULT_SCHEDULES[0].periods.map((period) =>
        period.name === "Period 2" ? { ...period, endMin: 10 * 60 + 4 } : period,
      ),
    });
    if (!edited.ok) throw new Error("edited seed must parse");
    const at = 10 * 3600 + 4 * 60 + 30;
    expect(crossedBell(edited.value, at, at)).toBe(false);
    expect(crossedBell(edited.value, at, at + 1)).toBe(false);
  });
});

