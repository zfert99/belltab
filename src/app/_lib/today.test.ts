import { describe, expect, it } from "vitest";
import { localNow } from "@/lib/clock";
import { tabTitleFor, viewForNow } from "@/app/_lib/today";

/**
 * The seam between the clock and the engine.
 *
 * `viewForNow` is pure - it takes a reading rather than taking one - so these
 * are ordinary assertions with no fake timers, exactly like the engine's. What
 * they cover that the engine's do not is the RESOLUTION: which of the seeded
 * schedules the calendar points at, and the two ways there can be none.
 *
 * Dates are built with the local constructor and the suite is pinned to
 * America/New_York (vitest.config.js), so "Wednesday 09:30" means that on every
 * machine.
 */

/** Wednesday 2 September 2026, which the default calendar points at "regular". */
const wednesday = (hours: number, minutes: number, seconds = 0) =>
  localNow(new Date(2026, 8, 2, hours, minutes, seconds));

/** Saturday 5 September 2026 - the weekend, which the calendar leaves null. */
const saturday = (hours: number, minutes: number) =>
  localNow(new Date(2026, 8, 5, hours, minutes));

describe("viewForNow", () => {
  it("resolves a weekday to the Regular schedule and asks the engine", () => {
    const view = viewForNow(wednesday(9, 30));

    expect(view.kind).toBe("scheduled");
    if (view.kind !== "scheduled") return;

    expect(view.scheduleName).toBe("Regular");
    expect(view.state.phase).toBe("during");
    // Period 2 runs 09:05-10:05, so 09:30 is 35 minutes in and 35 to go.
    expect(view.state.current?.name).toBe("Period 2");
    expect(view.state.remainingSec).toBe(35 * 60);
  });

  it("reports the weekend as no school rather than as an empty day", () => {
    // The distinction is the whole point: "no school today" is a designed
    // screen, and a Saturday resolved to an empty schedule would instead render
    // a countdown that had already finished.
    expect(viewForNow(saturday(9, 30))).toEqual({ kind: "no-school" });
  });

  it("is before the first bell early in the morning", () => {
    const view = viewForNow(wednesday(7, 0));

    expect(view.kind).toBe("scheduled");
    if (view.kind !== "scheduled") return;

    expect(view.state.phase).toBe("before");
    expect(view.state.next?.name).toBe("Period 1");
    expect(view.state.remainingSec).toBe(60 * 60);
  });

  it("is after the last bell in the afternoon", () => {
    const view = viewForNow(wednesday(15, 0));

    expect(view.kind).toBe("scheduled");
    if (view.kind !== "scheduled") return;

    expect(view.state.phase).toBe("after");
  });

  it("counts the seconds, not just the minutes", () => {
    const view = viewForNow(wednesday(9, 30, 20));

    expect(view.kind).toBe("scheduled");
    if (view.kind !== "scheduled") return;

    // 34 minutes 40 seconds. A minute-resolution engine could not produce this,
    // which is why stateAt takes seconds.
    expect(view.state.remainingSec).toBe(34 * 60 + 40);
  });
});

describe("tabTitleFor", () => {
  it("puts the number first during a period", () => {
    // Number first so it survives truncation to a few characters, and the
    // separator is U+00B7 rather than a hyphen.
    expect(tabTitleFor(viewForNow(wednesday(9, 30)))).toBe("35m · Period 2");
  });

  it("ceils the minute, so a running period never reads 0m", () => {
    // 09:30:20 leaves 34m 40s. Flooring would show "34m"; the risk it guards
    // against is the last 59 seconds of a period reading "0m", which looks like
    // the period is already over.
    expect(tabTitleFor(viewForNow(wednesday(9, 30, 20)))).toBe("35m · Period 2");
  });

  it("counts down to the first bell before school", () => {
    expect(tabTitleFor(viewForNow(wednesday(7, 0)))).toBe("60m · Period 1");
  });

  it("says the day is done after the last bell", () => {
    expect(tabTitleFor(viewForNow(wednesday(15, 0)))).toBe("Done · BellTab");
  });

  it("says so on a day with no school", () => {
    expect(tabTitleFor(viewForNow(saturday(9, 30)))).toBe("No school · BellTab");
  });
});
