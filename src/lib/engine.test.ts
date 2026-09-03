import { describe, it, expect } from "vitest";
import { stateAt, periodStatusAt } from "./engine";
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

