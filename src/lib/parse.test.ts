import { describe, it, expect } from "vitest";
import {
  parseSchedule,
  parseScheduleCollection,
  parseCalendar,
  parseIsoDate,
  resolveScheduleId,
  SCHEDULE_LIMITS,
  type ParseResult,
} from "./parse";
import { DEFAULT_SCHEDULES, DEFAULT_CALENDAR, type ScheduleId } from "./schedule";

/**
 * The builders take `unknown`, not `Period`, on purpose.
 *
 * Half the cases below are deliberately malformed - a kind of "recess", a
 * fractional start minute, a start past midnight - and a typed builder would
 * refuse to construct exactly the inputs the parser exists to refuse.
 */
const period = (name: unknown, kind: unknown, startMin: unknown, endMin: unknown) => ({
  name,
  kind,
  startMin,
  endMin,
});
const schedule = (periods: unknown[], name: unknown = "Test") => ({ name, periods });

interface ErrorSite {
  index: number | null;
  field: string;
}

/** The first error's site, and a clear failure if the parse unexpectedly succeeded. */
const firstError = (result: ParseResult<unknown>): ErrorSite => {
  if (result.ok) throw new Error("expected this input to be refused, but it parsed");
  return { index: result.errors[0].index, field: result.errors[0].field };
};

const KNOWN_IDS: ScheduleId[] = DEFAULT_SCHEDULES.map((entry) => entry.id).filter(
  (id): id is ScheduleId => id !== null,
);

describe("parseSchedule", () => {
  // The seed data goes through the same parser as user input, so a typo in
  // schedule.ts fails here rather than shipping as a broken default.
  it.each([...DEFAULT_SCHEDULES])("accepts the seed schedule $name", (seed) => {
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
    if (!result.ok) throw new Error("expected this schedule to parse");
    expect(result.value.periods.map((p) => p.name)).toEqual(["First", "Second", "Third"]);
  });

  // The engine indexes `periods[0]` and `periods[length - 1]` as the day's
  // first and last bell without re-sorting. That is only safe because this
  // normalisation happened, so it is asserted rather than assumed.
  it("hands the engine periods already in the day's order", () => {
    const result = parseSchedule(
      schedule([period("Late", "class", 600, 660), period("Early", "class", 480, 540)]),
    );
    if (!result.ok) throw new Error("expected this schedule to parse");

    const starts = result.value.periods.map((p) => p.startMin);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  describe("overlap", () => {
    it("refuses it and names the period collided with", () => {
      const result = parseSchedule(
        schedule([period("Period 4", "class", 695, 750), period("A Lunch", "lunch", 700, 730)]),
      );
      if (result.ok) throw new Error("expected the overlap to be refused");
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
    const cases: Array<[string, unknown[], ErrorSite]> = [
      ["a blank period name", [period("  ", "class", 480, 540)], { index: 0, field: "name" }],
      ["an unknown kind", [period("X", "recess", 480, 540)], { index: 0, field: "kind" }],
      ["end before start", [period("X", "class", 540, 480)], { index: 0, field: "endMin" }],
      ["zero length", [period("X", "class", 540, 540)], { index: 0, field: "endMin" }],
      ["a fractional start", [period("X", "class", 480.5, 540)], { index: 0, field: "startMin" }],
      ["a start past midnight", [period("X", "class", 1441, 1450)], { index: 0, field: "startMin" }],
    ];

    it.each(cases)("rejects %s", (_label, periods, expected) => {
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

    // A row that is not an object at all has to fail against its own index,
    // not take the whole schedule down with a message naming no row.
    it("refuses a period that is not an object, by row", () => {
      expect(firstError(parseSchedule(schedule(["nope"])))).toEqual({ index: 0, field: "period" });
    });
  });
});

describe("parseScheduleCollection", () => {
  const valid = (name: string) => ({
    name,
    periods: [period("Period 1", "class", 480, 535)],
  });

  it("accepts the whole seed set", () => {
    const result = parseScheduleCollection([...DEFAULT_SCHEDULES]);
    if (!result.ok) throw new Error("the seed schedules should parse as a collection");
    expect(result.value).toHaveLength(DEFAULT_SCHEDULES.length);
  });

  it("accepts an empty list", () => {
    const result = parseScheduleCollection([]);
    if (!result.ok) throw new Error("an empty collection is a clean empty state, not an error");
    expect(result.value).toEqual([]);
  });

  it("refuses anything that is not a list", () => {
    expect(firstError(parseScheduleCollection(null))).toEqual({ index: null, field: "schedules" });
    expect(firstError(parseScheduleCollection({ 0: valid("A") }))).toEqual({
      index: null,
      field: "schedules",
    });
  });

  // The cap this function exists for. Between the port and this commit,
  // SCHEDULE_LIMITS.schedules was documented as a boundary and enforced by
  // nothing - the deleted src/store.js was its only caller.
  it("accepts exactly the cap and refuses one more", () => {
    const atCap = Array.from({ length: SCHEDULE_LIMITS.schedules }, (_, i) => valid(`S${i}`));
    expect(parseScheduleCollection(atCap).ok).toBe(true);

    const overCap = [...atCap, valid("one too many")];
    expect(firstError(parseScheduleCollection(overCap))).toEqual({
      index: null,
      field: "schedules",
    });
  });

  // Refuses rather than truncates: silently dropping schedule 51 from a link
  // someone was sent is a worse answer than saying the link is too big.
  it("does not truncate an oversized list", () => {
    const overCap = Array.from({ length: SCHEDULE_LIMITS.schedules + 5 }, (_, i) => valid(`S${i}`));
    const result = parseScheduleCollection(overCap);
    expect(result.ok).toBe(false);
  });

  it("indexes a bad entry by its position in the list", () => {
    const collection = [valid("good"), schedule([period("Period 1", "class", 535, 480)])];
    expect(firstError(parseScheduleCollection(collection))).toEqual({ index: 1, field: "schedule" });
  });

  // One bad schedule refuses the collection rather than yielding a shorter one.
  // A caller that got back three of four would have no way to know.
  it("refuses the whole collection when any entry is bad", () => {
    const result = parseScheduleCollection([valid("good"), null, valid("also good")]);
    expect(result.ok).toBe(false);
  });

  /**
   * The identity guarantee, which is what makes the calendar possible.
   *
   * The calendar points at schedules BY id, so a library schedule without one
   * is a schedule no weekday and no override could ever select. A single
   * schedule may legitimately have no id - one typed into the editor, one
   * decoded from a share link - so this is a COLLECTION guarantee, minted here
   * rather than demanded of whoever wrote the JSON.
   */
  describe("identity", () => {
    const idsOf = (input: unknown[]) => {
      const result = parseScheduleCollection(input);
      if (!result.ok) throw new Error("expected the collection to parse");
      return result.value.map((schedule) => schedule.id);
    };

    it("gives an id to a schedule that arrived without one", () => {
      expect(idsOf([valid("A")])).toEqual(["s1"]);
    });

    it("keeps the ids that arrived and mints only around them", () => {
      expect(idsOf([{ ...valid("A"), id: "s1" }, valid("B")])).toEqual(["s1", "s2"]);
    });

    it("keeps the seed set's own ids rather than renumbering them", () => {
      expect(idsOf([...DEFAULT_SCHEDULES])).toEqual(["regular", "delayed", "half", "assembly"]);
    });

    // The duplicate path is not hypothetical: it is exactly what "duplicate this
    // schedule" hands the boundary, and the FIRST claimant keeping the id is
    // what stops the copy from stealing every day pointing at the original.
    it("renumbers a duplicated id, leaving the first claimant holding it", () => {
      const ids = idsOf([
        { ...valid("original"), id: "regular" },
        { ...valid("copy"), id: "regular" },
      ]);

      expect(ids[0]).toBe("regular");
      expect(ids[1]).not.toBe("regular");
      expect(new Set(ids).size).toBe(2);
    });

    it.each([
      ["an empty string", ""],
      ["a number", 7],
      ["null", null],
    ])("mints over %s, which is not an id", (_label, id) => {
      expect(idsOf([{ ...valid("A"), id }])).toEqual(["s1"]);
    });

    // The narrowing to IdentifiedSchedule is a filter, and a filter that ever
    // dropped anything would shorten a library in silence.
    it("narrows to identified schedules without losing one", () => {
      const input = Array.from({ length: 12 }, (_, n) => valid(`S${n}`));
      expect(idsOf(input)).toHaveLength(12);
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
