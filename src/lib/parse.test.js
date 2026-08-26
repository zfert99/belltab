import { describe, it, expect } from "vitest";
import {
  parseSchedule,
  parseCalendar,
  parseIsoDate,
  resolveScheduleId,
  SCHEDULE_LIMITS,
} from "./parse.js";
import { DEFAULT_SCHEDULES, DEFAULT_CALENDAR } from "./schedule.js";

const period = (name, kind, startMin, endMin) => ({ name, kind, startMin, endMin });
const schedule = (periods, name = "Test") => ({ name, periods });
const firstError = (result) => ({ index: result.errors[0].index, field: result.errors[0].field });

const KNOWN_IDS = DEFAULT_SCHEDULES.map((entry) => entry.id);

describe("parseSchedule", () => {
  // The seed data goes through the same parser as user input, so a typo in
  // schedule.js fails here rather than shipping as a broken default.
  it.each(DEFAULT_SCHEDULES)("accepts the seed schedule $name", (seed) => {
    expect(parseSchedule(seed).ok).toBe(true);
  });

  it("returns a structured result, never a boolean", () => {
    const result = parseSchedule(schedule([]));
    expect(result).toHaveProperty("ok");
    expect(typeof result.ok).toBe("boolean");
  });

  it("sorts periods, because typed order is not the day's order", () => {
    const result = parseSchedule(
      schedule([
        period("Third", "class", 600, 660),
        period("First", "class", 480, 540),
        period("Second", "class", 540, 600),
      ]),
    );
    expect(result.value.periods.map((p) => p.name)).toEqual(["First", "Second", "Third"]);
  });

  describe("overlap", () => {
    it("refuses it and names the period collided with", () => {
      const result = parseSchedule(
        schedule([period("Period 4", "class", 695, 750), period("A Lunch", "lunch", 700, 730)]),
      );
      expect(result.ok).toBe(false);
      expect(result.errors[0].message).toBe(
        "A Lunch overlaps Period 4. Two periods cannot run at the same time.",
      );
    });

    // Detection needs a sorted copy, but the error has to land on the row the
    // user is actually looking at.
    it("blames the later period, by its original index", () => {
      const result = parseSchedule(
        schedule([period("A Lunch", "lunch", 700, 730), period("Period 4", "class", 695, 750)]),
      );
      expect(firstError(result)).toEqual({ index: 0, field: "startMin" });
    });

    it("treats touching as legal and one minute of overlap as not", () => {
      expect(
        parseSchedule(schedule([period("A", "class", 610, 665), period("B", "lunch", 665, 695)])).ok,
      ).toBe(true);
      expect(
        parseSchedule(schedule([period("A", "class", 610, 666), period("B", "lunch", 665, 695)])).ok,
      ).toBe(false);
    });

    it("leaves gaps alone — a hole in the day is not an error", () => {
      expect(
        parseSchedule(schedule([period("A", "class", 480, 540), period("B", "class", 600, 660)])).ok,
      ).toBe(true);
    });
  });

  describe("field errors", () => {
    it.each([
      ["a blank period name", [period("  ", "class", 480, 540)], { index: 0, field: "name" }],
      ["an unknown kind", [period("X", "recess", 480, 540)], { index: 0, field: "kind" }],
      ["end before start", [period("X", "class", 540, 480)], { index: 0, field: "endMin" }],
      ["zero length", [period("X", "class", 540, 540)], { index: 0, field: "endMin" }],
      ["a fractional start", [period("X", "class", 480.5, 540)], { index: 0, field: "startMin" }],
      ["a start past midnight", [period("X", "class", 1441, 1450)], { index: 0, field: "startMin" }],
    ])("rejects %s", (_label, periods, expected) => {
      const result = parseSchedule(schedule(periods));
      expect(result.ok).toBe(false);
      expect(firstError(result)).toEqual(expected);
    });

    it("rejects a blank schedule name against no row", () => {
      const result = parseSchedule(schedule([period("X", "class", 480, 540)], "   "));
      expect(firstError(result)).toEqual({ index: null, field: "name" });
    });
  });

  // These caps exist because schedules will one day arrive from a link someone
  // was sent. A hostile payload has to be refused before anything is built.
  describe("hostile input", () => {
    it.each([null, "nope", 42, undefined])("refuses %p", (input) => {
      expect(parseSchedule(input).ok).toBe(false);
    });

    it("refuses a schedule with no periods array", () => {
      expect(firstError(parseSchedule({ name: "X" }))).toEqual({ index: null, field: "periods" });
    });

    it("caps the period count", () => {
      const tooMany = Array.from({ length: SCHEDULE_LIMITS.periods + 1 }, (_, i) =>
        period(`P${i}`, "class", i, i + 1),
      );
      expect(firstError(parseSchedule(schedule(tooMany)))).toEqual({
        index: null,
        field: "periods",
      });
    });

    it("caps the name length", () => {
      const long = "y".repeat(SCHEDULE_LIMITS.nameChars + 1);
      expect(firstError(parseSchedule(schedule([period(long, "class", 480, 540)])))).toEqual({
        index: 0,
        field: "name",
      });
    });
  });
});

describe("parseIsoDate", () => {
  it("accepts a real date", () => {
    expect(parseIsoDate("2026-09-14")).toBe("2026-09-14");
  });

  it.each(["2026-9-14", "26-09-14", "2026/09/14", "", "today"])("rejects the shape %p", (value) => {
    expect(parseIsoDate(value)).toBeNull();
  });

  it.each([20260914, null, undefined, {}])("rejects the non-string %p", (value) => {
    expect(parseIsoDate(value)).toBeNull();
  });

  // Round-tripping through Date would roll 2026-02-30 forward to March 2nd and
  // call it valid. This is why the check is arithmetic.
  it("rejects days that do not exist", () => {
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("2026-13-01")).toBeNull();
    expect(parseIsoDate("2026-04-31")).toBeNull();
  });

  it("gets the leap-year rule right, including the century case", () => {
    expect(parseIsoDate("2026-02-29")).toBeNull();
    expect(parseIsoDate("2028-02-29")).toBe("2028-02-29");
    expect(parseIsoDate("1900-02-29")).toBeNull();
    expect(parseIsoDate("2000-02-29")).toBe("2000-02-29");
  });
});

describe("parseCalendar", () => {
  it("keeps the defaults intact", () => {
    expect(parseCalendar(DEFAULT_CALENDAR, KNOWN_IDS).weekdays).toEqual([
      null,
      "regular",
      "regular",
      "regular",
      "regular",
      "regular",
      null,
    ]);
  });

  it("always returns seven weekdays, whatever it was given", () => {
    expect(parseCalendar("nope", KNOWN_IDS).weekdays).toHaveLength(7);
    expect(parseCalendar({ weekdays: ["regular"] }, KNOWN_IDS).weekdays).toHaveLength(7);
    expect(parseCalendar(null, KNOWN_IDS).weekdays).toHaveLength(7);
  });

  it("degrades a reference to a deleted schedule into no school", () => {
    const weekdays = [null, "deleted", null, null, null, null, null];
    expect(parseCalendar({ weekdays }, KNOWN_IDS).weekdays[1]).toBeNull();
  });

  describe("overrides", () => {
    const parsed = parseCalendar(
      {
        overrides: [
          { date: "2026-12-25", scheduleId: null },
          { date: "2026-09-14", scheduleId: "assembly" },
          { date: "2026-09-14", scheduleId: "half" },
          { date: "not-a-date", scheduleId: "regular" },
          { date: "2026-10-01", scheduleId: "deleted" },
        ],
      },
      KNOWN_IDS,
    );

    it("drops invalid dates and duplicates, keeping the first", () => {
      expect(parsed.overrides).toHaveLength(3);
      expect(parsed.overrides[0].scheduleId).toBe("assembly");
    });

    it("sorts by date", () => {
      expect(parsed.overrides.map((o) => o.date)).toEqual([
        "2026-09-14",
        "2026-10-01",
        "2026-12-25",
      ]);
    });

    it("turns an unknown id into a closure and keeps an explicit one", () => {
      expect(parsed.overrides[1].scheduleId).toBeNull();
      expect(parsed.overrides[2].scheduleId).toBeNull();
    });
  });
});

describe("resolveScheduleId", () => {
  const calendar = parseCalendar(
    {
      weekdays: [null, "regular", "regular", "regular", "regular", "regular", null],
      overrides: [
        { date: "2026-09-14", scheduleId: "assembly" },
        { date: "2026-12-25", scheduleId: null },
      ],
    },
    KNOWN_IDS,
  );

  it("falls back to the weekday map", () => {
    expect(resolveScheduleId(calendar, "2026-08-24", 1)).toBe("regular");
  });

  it("reports no school at the weekend", () => {
    expect(resolveScheduleId(calendar, "2026-08-23", 0)).toBeNull();
    expect(resolveScheduleId(calendar, "2026-08-22", 6)).toBeNull();
  });

  it("lets an override beat the weekday", () => {
    expect(resolveScheduleId(calendar, "2026-09-14", 1)).toBe("assembly");
  });

  // The one that would silently break every snow day: if this tested the
  // override's VALUE rather than its presence, a closure would fall through to
  // "Friday is Regular" and the app would confidently count down bells.
  it("treats a null override as a closure, not a missing entry", () => {
    expect(resolveScheduleId(calendar, "2026-12-25", 5)).toBeNull();
  });
});
