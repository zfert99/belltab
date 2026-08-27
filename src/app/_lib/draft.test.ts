import { describe, expect, it } from "vitest";
import { DEFAULT_SCHEDULES } from "@/lib/schedule";
import {
  addPeriod,
  clockToMinutes,
  deletePeriod,
  minutesToClock,
  movePeriod,
  parseDraft,
  toDraft,
  updatePeriod,
  type Draft,
} from "@/app/_lib/draft";

/**
 * The editor's data layer, tested without an editor.
 *
 * Every function here is a draft in, a draft out, so the interesting
 * behaviour - what a reorder does to the clock, what "Add period" can and
 * cannot collide with - is assertable without rendering anything or faking a
 * DOM. What is NOT tested here is that the UI calls them; that is what
 * `e2e/editor.spec.ts` is for.
 */

const regular = DEFAULT_SCHEDULES[0];

/** A three-period day with a gap in it, small enough to reason about. */
const sample: Draft = {
  id: "test",
  name: "Test",
  nextRowId: 3,
  periods: [
    { rowId: "0", name: "First", kind: "class", start: "08:00", length: "50" },
    { rowId: "1", name: "Second", kind: "class", start: "09:00", length: "30" },
    { rowId: "2", name: "Third", kind: "class", start: "09:30", length: "40" },
  ],
};

describe("clockToMinutes", () => {
  it.each([
    ["00:00", 0],
    ["08:00", 480],
    ["09:05", 545],
    ["23:59", 1439],
    ["9:05", 545],
  ])("reads %s as %i", (value, expected) => {
    expect(clockToMinutes(value)).toBe(expected);
  });

  it.each(["", "9", "09:5", "24:00", "09:60", "nine", "09:05:00"])(
    "refuses %o rather than guessing",
    (value) => {
      // A half-typed time is a normal state of an input, not an error to
      // recover from. Null is what parseSchedule turns into a message.
      expect(clockToMinutes(value)).toBeNull();
    },
  );
});

describe("minutesToClock", () => {
  it("zero-pads, because input[type=time] rejects anything else", () => {
    // "9:05" is silently refused by the control and renders as blank.
    expect(minutesToClock(545)).toBe("09:05");
    expect(minutesToClock(0)).toBe("00:00");
    expect(minutesToClock(1439)).toBe("23:59");
  });

  it("round-trips with clockToMinutes at every minute of the day", () => {
    for (let minute = 0; minute < 1440; minute++) {
      expect(clockToMinutes(minutesToClock(minute))).toBe(minute);
    }
  });
});

describe("toDraft", () => {
  it("turns an end time into a length", () => {
    const draft = toDraft(regular);

    // Period 1 is 08:00-08:55 in the seed data.
    expect(draft.periods[0]).toMatchObject({ name: "Period 1", start: "08:00", length: "55" });
  });

  it("gives every row a distinct id, and reserves the next one", () => {
    const draft = toDraft(regular);
    const ids = draft.periods.map((row) => row.rowId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(draft.nextRowId).toBe(regular.periods.length);
  });

  it("survives a round trip through the parser unchanged", () => {
    const result = parseDraft(toDraft(regular));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.periods).toEqual(regular.periods);
  });
});

describe("parseDraft", () => {
  it("reports a blank name against the row and field that hold it", () => {
    const result = parseDraft(updatePeriod(sample, "1", { name: "  " }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // index and field are what let the editor bind the message to the input
    // with aria-describedby rather than colouring a border red.
    expect(result.errors).toContainEqual({
      index: 1,
      field: "name",
      message: "Give the period a name.",
    });
  });

  it("reports a half-typed time rather than dropping the row", () => {
    const result = parseDraft(updatePeriod(sample, "0", { start: "08:" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.index === 0 && error.field === "startMin")).toBe(true);
  });

  it("reports a blank length against the length box", () => {
    // The parser calls the field `endMin`, because it has no idea the form took
    // the end time apart into a start and a duration. PeriodRow maps it back.
    const result = parseDraft(updatePeriod(sample, "0", { length: "" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.index === 0 && error.field === "endMin")).toBe(true);
  });

  it("names the period an overlap collides with", () => {
    // The roadmap's requirement in one assertion: not "invalid", but which.
    const result = parseDraft(updatePeriod(sample, "1", { start: "08:30" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toBe(
      "Second overlaps First. Two periods cannot run at the same time.",
    );
  });

  it("accepts a schedule with no periods at all", () => {
    // Deleting the last row is a legal state, not an error - it renders the
    // "this schedule has no periods" screen. Gaps are legal too, and `sample`
    // has one between First and Second.
    const emptied = { ...sample, periods: [] };

    expect(parseDraft(emptied).ok).toBe(true);
    expect(parseDraft(sample).ok).toBe(true);
  });
});

describe("addPeriod", () => {
  it("starts the new row where the day currently ends", () => {
    // The one placement that cannot collide with anything, so "Add period" is
    // never the click that breaks the schedule.
    const added = addPeriod(sample);
    const row = added.periods[added.periods.length - 1];

    expect(added.periods).toHaveLength(4);
    expect(row.start).toBe("10:10");
    expect(parseDraft(added).ok).toBe(false); // only because the name is blank
    expect(parseDraft(updatePeriod(added, row.rowId, { name: "Fourth" })).ok).toBe(true);
  });

  it("starts at 08:00 when there is nothing to follow", () => {
    const added = addPeriod({ ...sample, periods: [] });

    // Not midnight: a schedule beginning at 00:00 is a placeholder nobody meant.
    expect(added.periods[0].start).toBe("08:00");
  });

  it("leaves the time blank rather than wrapping past midnight", () => {
    const late = updatePeriod(sample, "2", { start: "23:30", length: "20" });
    const added = addPeriod({ ...late, periods: [late.periods[2]] });

    expect(added.periods[1].start).toBe("");
  });

  it("gives the new row an id no existing row is using", () => {
    const added = addPeriod(sample);
    const ids = added.periods.map((row) => row.rowId);

    // Row ids are React keys. Reusing one carries a half-typed value onto a
    // different period the next time the list is reordered.
    expect(new Set(ids).size).toBe(ids.length);
    expect(added.nextRowId).toBe(sample.nextRowId + 1);
  });
});

describe("movePeriod", () => {
  it("swaps the pair and moves the clock with them", () => {
    // Periods are stored sorted by start, so a reorder that only moved rows in
    // the list would be undone by the next parse. The times have to move.
    const moved = movePeriod(sample, "2", -1);

    expect(moved.periods.map((row) => row.name)).toEqual(["First", "Third", "Second"]);
    expect(moved.periods[1]).toMatchObject({ name: "Third", start: "09:00", length: "40" });
    expect(moved.periods[2]).toMatchObject({ name: "Second", start: "09:40", length: "30" });
  });

  it("cannot produce an overlap, in either direction", () => {
    for (const rowId of ["0", "1", "2"]) {
      for (const direction of [-1, 1] as const) {
        expect(parseDraft(movePeriod(sample, rowId, direction)).ok).toBe(true);
      }
    }
  });

  it("is its own inverse", () => {
    const there = movePeriod(sample, "2", -1);
    const back = movePeriod(there, "2", 1);

    expect(back.periods).toEqual(sample.periods);
  });

  it("keeps the gap, after the pair rather than inside it", () => {
    // First ends 08:50 and Second starts 09:00, so there is a ten-minute hole.
    // Swapping the two later periods must not swallow or duplicate it.
    const moved = movePeriod(sample, "1", 1);

    expect(moved.periods[1]).toMatchObject({ name: "Third", start: "09:00" });
    expect(moved.periods[2]).toMatchObject({ name: "Second", start: "09:40" });
  });

  it("does nothing at the ends of the list", () => {
    expect(movePeriod(sample, "0", -1)).toEqual(sample);
    expect(movePeriod(sample, "2", 1)).toEqual(sample);
  });

  it("does nothing while a time is half-typed", () => {
    // A move that cannot be computed is a no-op rather than a guess.
    const typing = updatePeriod(sample, "1", { start: "09:" });

    expect(movePeriod(typing, "2", -1)).toEqual(typing);
  });

  it("does nothing for a row that is not there", () => {
    expect(movePeriod(sample, "nope", -1)).toEqual(sample);
  });
});

describe("deletePeriod", () => {
  it("removes exactly the row named", () => {
    const left = deletePeriod(sample, "1");

    expect(left.periods.map((row) => row.name)).toEqual(["First", "Third"]);
  });

  it("leaves a schedule that still parses", () => {
    // Deleting cannot create an overlap - it can only create a gap, and gaps
    // are legal.
    expect(parseDraft(deletePeriod(sample, "1")).ok).toBe(true);
  });
});

describe("updatePeriod", () => {
  it("touches one row and copies the rest", () => {
    const changed = updatePeriod(sample, "1", { name: "Renamed" });

    expect(changed.periods[1].name).toBe("Renamed");
    expect(changed.periods[0]).toBe(sample.periods[0]);
    expect(changed.periods[2]).toBe(sample.periods[2]);
  });
});
