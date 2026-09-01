import { describe, expect, it } from "vitest";
import { localNow } from "@/lib/clock";
import { DEFAULT_LIBRARY } from "@/app/_lib/library";
import {
  scheduleIndexToEdit,
  scheduleNameOn,
  tabTitleFor,
  viewForNow,
} from "@/app/_lib/today";

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

/**
 * The library is `DEFAULT_LIBRARY` throughout, which is what a fresh install
 * holds. Phase 3 made it a parameter, so the cases the seeded one cannot reach
 * - an empty library, a calendar pointing nowhere - get their own tests at the
 * bottom rather than being unreachable.
 */

/** Wednesday 2 September 2026, which the default calendar points at "regular". */
const wednesday = (hours: number, minutes: number, seconds = 0) =>
  localNow(new Date(2026, 8, 2, hours, minutes, seconds));

/** Saturday 5 September 2026 - the weekend, which the calendar leaves null. */
const saturday = (hours: number, minutes: number) =>
  localNow(new Date(2026, 8, 5, hours, minutes));

describe("viewForNow", () => {
  it("resolves a weekday to the Regular schedule and asks the engine", () => {
    const view = viewForNow(DEFAULT_LIBRARY, wednesday(9, 30));

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
    expect(viewForNow(DEFAULT_LIBRARY, saturday(9, 30))).toEqual({ kind: "no-school" });
  });

  it("is before the first bell early in the morning", () => {
    const view = viewForNow(DEFAULT_LIBRARY, wednesday(7, 0));

    expect(view.kind).toBe("scheduled");
    if (view.kind !== "scheduled") return;

    expect(view.state.phase).toBe("before");
    expect(view.state.next?.name).toBe("Period 1");
    expect(view.state.remainingSec).toBe(60 * 60);
  });

  it("is after the last bell in the afternoon", () => {
    const view = viewForNow(DEFAULT_LIBRARY, wednesday(15, 0));

    expect(view.kind).toBe("scheduled");
    if (view.kind !== "scheduled") return;

    expect(view.state.phase).toBe("after");
  });

  it("counts the seconds, not just the minutes", () => {
    const view = viewForNow(DEFAULT_LIBRARY, wednesday(9, 30, 20));

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
    expect(tabTitleFor(viewForNow(DEFAULT_LIBRARY, wednesday(9, 30)))).toBe("35m · Period 2");
  });

  it("ceils the minute, so a running period never reads 0m", () => {
    // 09:30:20 leaves 34m 40s. Flooring would show "34m"; the risk it guards
    // against is the last 59 seconds of a period reading "0m", which looks like
    // the period is already over.
    expect(tabTitleFor(viewForNow(DEFAULT_LIBRARY, wednesday(9, 30, 20)))).toBe("35m · Period 2");
  });

  it("counts down to the first bell before school", () => {
    expect(tabTitleFor(viewForNow(DEFAULT_LIBRARY, wednesday(7, 0)))).toBe("60m · Period 1");
  });

  it("says the day is done after the last bell", () => {
    expect(tabTitleFor(viewForNow(DEFAULT_LIBRARY, wednesday(15, 0)))).toBe("Done · BellTab");
  });

  it("says so on a day with no school", () => {
    expect(tabTitleFor(viewForNow(DEFAULT_LIBRARY, saturday(9, 30)))).toBe("No school · BellTab");
  });
});

describe("with a library the seeded one cannot produce", () => {
  const empty = { schedules: [], calendar: DEFAULT_LIBRARY.calendar };

  it("reports an empty library as the onboarding state, not as no school", () => {
    // Two different screens: "no school today" is a day off, "no schedules"
    // is a user who has not set anything up. Phase 2 could not test this at
    // all, because the library was a module constant that always had four.
    expect(viewForNow(empty, wednesday(9, 30))).toEqual({ kind: "no-schedules" });
    expect(tabTitleFor(viewForNow(empty, wednesday(9, 30)))).toBe("BellTab");
  });

  it("falls back to no school when the calendar points at a schedule that is gone", () => {
    // parseCalendar drops unknown ids, so this is really a belt-and-braces
    // check that a dangling pointer degrades rather than throws.
    const dangling = {
      schedules: DEFAULT_LIBRARY.schedules,
      calendar: { weekdays: [null, null, null, null, null, null, null] as const, overrides: [] },
    };

    expect(viewForNow(dangling, wednesday(9, 30))).toEqual({ kind: "no-school" });
  });
});

describe("scheduleIndexToEdit", () => {
  const nameAt = (index: number | null) =>
    index === null ? null : DEFAULT_LIBRARY.schedules[index].name;

  it("opens on the schedule running today", () => {
    expect(nameAt(scheduleIndexToEdit(DEFAULT_LIBRARY, wednesday(9, 30)))).toBe("Regular");
  });

  it("falls back to the first schedule at the weekend", () => {
    // Somebody setting up their timetable on a Sunday should not be shown an
    // empty editor and told to come back Monday.
    expect(nameAt(scheduleIndexToEdit(DEFAULT_LIBRARY, saturday(9, 30)))).toBe("Regular");
  });

  it("falls back to the first schedule before the clock has been read", () => {
    expect(nameAt(scheduleIndexToEdit(DEFAULT_LIBRARY, null))).toBe("Regular");
  });

  it("has nothing to open when the library is empty", () => {
    expect(scheduleIndexToEdit({ schedules: [], calendar: DEFAULT_LIBRARY.calendar }, null)).toBeNull();
  });
});

describe("scheduleNameOn", () => {
  it("names the schedule a weekday resolves to", () => {
    expect(scheduleNameOn(DEFAULT_LIBRARY, "2026-09-02", 3)).toBe("Regular");
  });

  it("is null on a day the calendar points nowhere", () => {
    expect(scheduleNameOn(DEFAULT_LIBRARY, "2026-09-05", 6)).toBeNull();
  });

  it("lets an override beat the weekday, in both directions", () => {
    const withOverrides = {
      schedules: DEFAULT_LIBRARY.schedules,
      calendar: {
        weekdays: DEFAULT_LIBRARY.calendar.weekdays,
        overrides: [
          { date: "2026-09-02", scheduleId: "assembly" },
          // A closure on a school day, which is the case that proves the
          // resolver checks for the entry rather than for its value.
          { date: "2026-09-03", scheduleId: null },
        ],
      },
    };

    expect(scheduleNameOn(withOverrides, "2026-09-02", 3)).toBe("Assembly");
    expect(scheduleNameOn(withOverrides, "2026-09-03", 4)).toBeNull();
  });
});
