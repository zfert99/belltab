import { describe, expect, it } from "vitest";
import { SCHEDULE_LIMITS } from "@/lib/parse";
import {
  DEFAULT_LIBRARY,
  addSchedule,
  createSchedule,
  deleteSchedule,
  duplicateSchedule,
  loadLibrary,
  parseLibrary,
  removeOverride,
  replaceLibrary,
  serializeLibrary,
  setOverride,
  setWeekday,
  type Library,
  pastOverrides,
  removePastOverrides,
} from "@/app/_lib/library";

/**
 * The `localStorage` boundary, tested as a pure function.
 *
 * `loadLibrary` takes the raw string rather than reading storage itself, which
 * is what makes this a plain unit test with no DOM and no mocking. What it is
 * really asserting is the rule from `AGENTS.md`: a corrupt or absent value
 * degrades to a clean state and NEVER crashes. Every case below is a byte
 * sequence some browser could hand back - truncated by a quota error, written
 * by an older version, or edited by hand in devtools.
 */

describe("loadLibrary", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(loadLibrary(null)).toEqual(DEFAULT_LIBRARY);
  });

  it.each([
    ["an empty string", ""],
    ["truncated JSON", '{"schedules":[{"name":"Reg'],
    ["a bare string", '"hello"'],
    ["a number", "42"],
    ["null", "null"],
    ["an array", "[]"],
    ["the right shape with the wrong contents", '{"schedules":"regular"}'],
    ["a schedule that is not an object", '{"schedules":[7]}'],
    ["a period with no name", '{"schedules":[{"name":"X","periods":[{"kind":"Class","startMin":0,"endMin":5}]}]}'],
    [
      "two periods that overlap",
      '{"schedules":[{"name":"X","periods":[{"name":"A","kind":"Class","startMin":0,"endMin":60},{"name":"B","kind":"Class","startMin":30,"endMin":90}]}]}',
    ],
  ])("degrades to the defaults for %s", (_label, raw) => {
    expect(loadLibrary(raw)).toEqual(DEFAULT_LIBRARY);
  });

  it("round-trips a library it wrote itself", () => {
    expect(loadLibrary(serializeLibrary(DEFAULT_LIBRARY))).toEqual(DEFAULT_LIBRARY);
  });

  it("accepts a stored library with no schedules in it", () => {
    // Distinct from a corrupt value: a user who deleted everything gets the
    // onboarding screen, not the seed data reappearing under them.
    const emptied = loadLibrary('{"schedules":[],"calendar":{"weekdays":[],"overrides":[]}}');

    expect(emptied.schedules).toEqual([]);
  });

  it("drops a weekday pointing at a schedule that is not there", () => {
    // parseCalendar cannot fail - a dangling pointer degrades to "no school",
    // which is a screen the app already renders properly.
    const library = loadLibrary(
      '{"schedules":[{"id":"a","name":"A","periods":[]}],"calendar":{"weekdays":["gone","a",null,null,null,null,null],"overrides":[]}}',
    );

    expect(library.calendar.weekdays[0]).toBeNull();
    expect(library.calendar.weekdays[1]).toBe("a");
  });

  it("keeps an override that closes the school", () => {
    // A scheduleId of null is an explicit closure - a snow day - and has to
    // survive the trip, because it is what beats the weekday map.
    const library = loadLibrary(
      '{"schedules":[{"id":"a","name":"A","periods":[]}],"calendar":{"weekdays":[null,null,null,null,null,null,null],"overrides":[{"date":"2026-12-25","scheduleId":null}]}}',
    );

    expect(library.calendar.overrides).toEqual([{ date: "2026-12-25", scheduleId: null }]);
  });
});

describe("serializeLibrary", () => {
  it("writes plain, readable JSON", () => {
    // The same shape Phase 5's export will write, so a user who opens devtools
    // sees the file they could have exported. No compression: this is hundreds
    // of bytes and it is never sent anywhere.
    const written = JSON.parse(serializeLibrary(DEFAULT_LIBRARY));

    expect(Object.keys(written).sort()).toEqual(["calendar", "schedules"]);
    expect(written.schedules[0].periods[0]).toEqual({
      name: "Period 1",
      kind: "Class",
      startMin: 480,
      endMin: 535,
    });
  });
});

/**
 * The mutators, which are where Phase 4's product decisions actually live.
 *
 * Every one is a pure function from a library to a library, so the whole of
 * "what happens to the calendar when you delete the schedule Wednesday points
 * at" is assertable without a browser, a store or a clock. What is NOT tested
 * here is that the UI calls them; that is what `e2e/calendar.spec.ts` and
 * `e2e/confirm-dialog.spec.ts` are for.
 */

const idOf = (library: Library, index: number) => library.schedules[index].id;
const names = (library: Library) => library.schedules.map((schedule) => schedule.name);

describe("createSchedule", () => {
  it("appends an empty schedule with an id of its own", () => {
    const next = createSchedule(DEFAULT_LIBRARY);
    const created = next.schedules[next.schedules.length - 1];

    expect(next.schedules).toHaveLength(DEFAULT_LIBRARY.schedules.length + 1);
    expect(created.name).toBe("New schedule");
    expect(created.periods).toEqual([]);

    // An id nothing else answers to, or the calendar could not tell them apart.
    expect(new Set(next.schedules.map((schedule) => schedule.id)).size).toBe(
      next.schedules.length,
    );
  });

  it("leaves the calendar alone, so a new schedule runs on no day yet", () => {
    expect(createSchedule(DEFAULT_LIBRARY).calendar).toEqual(DEFAULT_LIBRARY.calendar);
  });

  it("creates from nothing, which is the onboarding path", () => {
    const empty: Library = { schedules: [], calendar: DEFAULT_LIBRARY.calendar };
    expect(createSchedule(empty).schedules).toHaveLength(1);
  });

  it("refuses past the schedule cap rather than returning half a library", () => {
    let library: Library = { schedules: [], calendar: DEFAULT_LIBRARY.calendar };
    for (let n = 0; n < SCHEDULE_LIMITS.schedules; n++) library = createSchedule(library, `S${n}`);

    expect(library.schedules).toHaveLength(SCHEDULE_LIMITS.schedules);
    expect(createSchedule(library)).toBe(library);
  });
});

describe("duplicateSchedule", () => {
  it("copies the periods in beside the original, under a new name and id", () => {
    const next = duplicateSchedule(DEFAULT_LIBRARY, 0);

    expect(names(next)[0]).toBe("Regular");
    expect(names(next)[1]).toBe("Regular (copy)");
    expect(next.schedules[1].periods).toEqual(next.schedules[0].periods);

    // The ORIGINAL keeps the id, so every day already pointing at it still does.
    expect(idOf(next, 0)).toBe(idOf(DEFAULT_LIBRARY, 0));
    expect(idOf(next, 1)).not.toBe(idOf(next, 0));
    expect(next.calendar).toEqual(DEFAULT_LIBRARY.calendar);
  });

  it("truncates a name at the cap so the copy is not silently refused", () => {
    const longName = "z".repeat(SCHEDULE_LIMITS.nameChars);
    const library = createSchedule(DEFAULT_LIBRARY, longName);
    const next = duplicateSchedule(library, library.schedules.length - 1);

    expect(next.schedules).toHaveLength(library.schedules.length + 1);
    expect(next.schedules[next.schedules.length - 1].name.length).toBeLessThanOrEqual(
      SCHEDULE_LIMITS.nameChars,
    );
    expect(next.schedules[next.schedules.length - 1].name.endsWith(" (copy)")).toBe(true);
  });

  it("is a no-op for an index that is not there", () => {
    expect(duplicateSchedule(DEFAULT_LIBRARY, 99)).toBe(DEFAULT_LIBRARY);
  });
});

describe("deleteSchedule", () => {
  it("removes it and turns the days pointing at it into no school", () => {
    const next = deleteSchedule(DEFAULT_LIBRARY, 0);

    expect(names(next)).not.toContain("Regular");
    // The default calendar points Monday to Friday at "regular".
    expect(next.calendar.weekdays).toEqual([null, null, null, null, null, null, null]);
  });

  it("DROPS overrides pointing at it rather than inventing a snow day", () => {
    // parseCalendar turns a dangling id into scheduleId: null, which is an
    // explicit closure - so rebuilding without the filter would quietly turn
    // "assembly on the 14th" into "the school is shut on the 14th".
    const library = setOverride(DEFAULT_LIBRARY, "2026-09-14", "assembly");
    const assemblyIndex = library.schedules.findIndex((schedule) => schedule.name === "Assembly");

    expect(deleteSchedule(library, assemblyIndex).calendar.overrides).toEqual([]);
  });

  it("keeps a closure that was never pointing at it", () => {
    const library = setOverride(DEFAULT_LIBRARY, "2026-12-25", null);

    expect(deleteSchedule(library, 0).calendar.overrides).toEqual([
      { date: "2026-12-25", scheduleId: null },
    ]);
  });

  it("lets the last schedule go, landing on the onboarding state", () => {
    let library = DEFAULT_LIBRARY;
    while (library.schedules.length > 0) library = deleteSchedule(library, 0);

    expect(library.schedules).toEqual([]);
    expect(library.calendar.weekdays).toEqual([null, null, null, null, null, null, null]);
  });

  it("is a no-op for an index that is not there", () => {
    expect(deleteSchedule(DEFAULT_LIBRARY, -1)).toBe(DEFAULT_LIBRARY);
  });
});

describe("the calendar mutators", () => {
  it("sets and clears a weekday", () => {
    const monday = setWeekday(DEFAULT_LIBRARY, 1, "half");
    expect(monday.calendar.weekdays[1]).toBe("half");

    expect(setWeekday(monday, 1, null).calendar.weekdays[1]).toBeNull();
  });

  it("leaves the other six weekdays alone", () => {
    const next = setWeekday(DEFAULT_LIBRARY, 3, "delayed");

    expect(next.calendar.weekdays).toEqual([
      null,
      "regular",
      "regular",
      "delayed",
      "regular",
      "regular",
      null,
    ]);
  });

  it("ignores a weekday pointing at a schedule that does not exist", () => {
    expect(setWeekday(DEFAULT_LIBRARY, 1, "nonsense").calendar.weekdays[1]).toBeNull();
  });

  it("replaces an existing exception for the same date rather than duplicating it", () => {
    const once = setOverride(DEFAULT_LIBRARY, "2026-09-14", "assembly");
    const twice = setOverride(once, "2026-09-14", "half");

    expect(twice.calendar.overrides).toEqual([{ date: "2026-09-14", scheduleId: "half" }]);
  });

  it("keeps the exceptions in date order however they were added", () => {
    const library = setOverride(
      setOverride(DEFAULT_LIBRARY, "2026-12-25", null),
      "2026-09-14",
      "assembly",
    );

    expect(library.calendar.overrides.map((entry) => entry.date)).toEqual([
      "2026-09-14",
      "2026-12-25",
    ]);
  });

  it("records a closure as an entry, not as an absence", () => {
    // The distinction the resolver depends on: an override to null BEATS the
    // weekday map, where a missing entry falls through to it.
    const library = setOverride(DEFAULT_LIBRARY, "2026-09-14", null);

    expect(library.calendar.overrides).toEqual([{ date: "2026-09-14", scheduleId: null }]);
    expect(removeOverride(library, "2026-09-14").calendar.overrides).toEqual([]);
  });

  it("refuses an exception on a date that is not a date", () => {
    // `IsoDate` is a bare string alias, so this arrives typed correctly. Before
    // the Phase 4 review it reached `parseCalendar`, which dropped it - leaving
    // a caller holding a new library object, no entry, and no way to tell.
    // Identity, not just an empty list: the refusal has to be visible.
    expect(setOverride(DEFAULT_LIBRARY, "2026-02-30", "regular")).toBe(DEFAULT_LIBRARY);
  });

  it.each([
    ["a five-digit year, which Chrome's date input really does produce", "20260-09-14"],
    ["an empty string", ""],
    ["a month that does not exist", "2026-13-01"],
    ["a day February does not have that year", "2026-02-29"],
  ])("refuses %s", (_label, date) => {
    expect(setOverride(DEFAULT_LIBRARY, date, "regular")).toBe(DEFAULT_LIBRARY);
  });

  describe("at the override cap", () => {
    /**
     * A calendar with exactly `SCHEDULE_LIMITS.overrides` exceptions on it.
     *
     * Built through `setOverride` rather than by hand, so the fixture is
     * reachable by the same route a user would take to get there.
     */
    const full = (() => {
      let library: Library = DEFAULT_LIBRARY;
      for (let n = 0; n < SCHEDULE_LIMITS.overrides; n++) {
        const year = 2000 + Math.floor(n / (28 * 12));
        const month = String((Math.floor(n / 28) % 12) + 1).padStart(2, "0");
        const day = String((n % 28) + 1).padStart(2, "0");
        library = setOverride(library, `${year}-${month}-${day}`, "regular");
      }
      return library;
    })();

    it("has reached it", () => {
      expect(full.calendar.overrides).toHaveLength(SCHEDULE_LIMITS.overrides);
    });

    /**
     * The Phase 4 review's finding 1.
     *
     * `parseCalendar` enforces the cap by keeping the FIRST 400, which is right
     * for an untrusted payload and useless as flow control: the entry the user
     * just added is appended last, so it was the one discarded. The function
     * returned a library that looked updated and was not.
     */
    it("refuses a NEW date rather than silently discarding it", () => {
      expect(setOverride(full, "2099-12-25", "assembly")).toBe(full);
    });

    /**
     * The other half of the same finding. Replacing cannot grow the calendar, so
     * the cap has nothing to say about it - and the UI gate that refused it was
     * wrong in the opposite direction from the mutator that accepted the add.
     */
    it("still REPLACES a date that already has an exception", () => {
      const existing = full.calendar.overrides[0].date;
      const after = setOverride(full, existing, "assembly");

      expect(after).not.toBe(full);
      expect(after.calendar.overrides).toHaveLength(SCHEDULE_LIMITS.overrides);
      expect(after.calendar.overrides.find((entry) => entry.date === existing)?.scheduleId).toBe(
        "assembly",
      );
    });

    it("still removes one, which is the way back under the cap", () => {
      const existing = full.calendar.overrides[0].date;
      const after = removeOverride(full, existing);

      expect(after.calendar.overrides).toHaveLength(SCHEDULE_LIMITS.overrides - 1);
      expect(setOverride(after, "2099-12-25", "assembly").calendar.overrides).toHaveLength(
        SCHEDULE_LIMITS.overrides,
      );
    });
  });

  it("survives a round trip through storage", () => {
    const library = setOverride(setWeekday(DEFAULT_LIBRARY, 3, "delayed"), "2026-09-14", "assembly");

    expect(loadLibrary(serializeLibrary(library))).toEqual(library);
  });
});

/**
 * Import, which is `loadLibrary` with the opposite attitude to failure.
 *
 * A corrupt `localStorage` value must degrade silently, because refusing to
 * open is worse than opening on the seeds. A file the user deliberately CHOSE
 * must not: silently replacing their library with seed data because a byte was
 * wrong is the worst answer available. Same parse, different caller.
 */
describe("parseLibrary", () => {
  const message = (raw: string) => {
    const result = parseLibrary(raw);
    if (result.ok) throw new Error(`expected "${raw.slice(0, 30)}" to be refused`);
    return result.errors[0].message;
  };

  it("accepts what serializeLibrary wrote", () => {
    const result = parseLibrary(serializeLibrary(DEFAULT_LIBRARY));
    if (!result.ok) throw new Error("a library BellTab wrote must import");

    expect(result.value).toEqual(DEFAULT_LIBRARY);
  });

  it.each([
    ["not JSON at all", "this is not json"],
    ["truncated JSON", '{"schedules":[{"name":"Reg'],
  ])("refuses %s and says it is not JSON", (_label, raw) => {
    expect(message(raw)).toContain("not JSON");
  });

  it.each([
    ["a bare string", '"hello"'],
    ["a number", "42"],
    ["null", "null"],
    ["an array", "[]"],
  ])("refuses %s as not a backup", (_label, raw) => {
    expect(message(raw)).toContain("not a BellTab backup");
  });

  it("quotes the parser's own reason when a schedule is unreadable", () => {
    // The user picked this file. "Something was wrong" is not a useful answer,
    // and the boundary already produced a better one.
    const raw = '{"schedules":[{"name":"X","periods":[{"kind":"Class","startMin":0,"endMin":5}]}]}';

    expect(message(raw)).toContain("cannot read");
    expect(message(raw)).toContain("Give the period a name.");
  });

  it("keeps a calendar pointing at a schedule the backup does not contain, as no school", () => {
    // Deliberately NOT all-or-nothing, exactly as on load: a dangling pointer
    // degrades to a screen the app renders properly.
    const result = parseLibrary(
      '{"schedules":[{"id":"a","name":"A","periods":[]}],"calendar":{"weekdays":["gone","a",null,null,null,null,null],"overrides":[]}}',
    );
    if (!result.ok) throw new Error("a dangling weekday must not refuse the whole backup");

    expect(result.value.calendar.weekdays[0]).toBeNull();
    expect(result.value.calendar.weekdays[1]).toBe("a");
  });

  it("agrees with loadLibrary on everything it refuses", () => {
    // The two share a parser, and this is what pins that they still do: every
    // input loadLibrary degrades on is one parseLibrary reports.
    for (const raw of ["", "42", "[]", '{"schedules":"regular"}']) {
      expect(parseLibrary(raw).ok).toBe(false);
      expect(loadLibrary(raw)).toEqual(DEFAULT_LIBRARY);
    }
  });
});

describe("addSchedule", () => {
  const shared = { id: null, name: "From a friend", periods: [] };

  it("appends it and gives it an id of its own", () => {
    const next = addSchedule(DEFAULT_LIBRARY, shared);
    const added = next.schedules[next.schedules.length - 1];

    expect(next.schedules).toHaveLength(DEFAULT_LIBRARY.schedules.length + 1);
    expect(added.name).toBe("From a friend");
    expect(new Set(next.schedules.map((entry) => entry.id)).size).toBe(next.schedules.length);
  });

  /**
   * The hostile case, and the reason `addSchedule` strips the id rather than
   * trusting it.
   *
   * A hand-crafted link can claim any id it likes. If it claimed `regular` and
   * that id were honoured, the recipient's Monday-to-Friday would silently start
   * running a stranger's schedule - the calendar points by id, and the id is all
   * it compares.
   */
  it("cannot claim an id the recipient already uses", () => {
    const next = addSchedule(DEFAULT_LIBRARY, { ...shared, id: "regular" });
    const added = next.schedules[next.schedules.length - 1];

    expect(added.id).not.toBe("regular");
    expect(next.schedules[0].id).toBe("regular");
    expect(next.schedules[0].name).toBe("Regular");
  });

  it("leaves the calendar alone, so a shared schedule runs on no day", () => {
    expect(addSchedule(DEFAULT_LIBRARY, shared).calendar).toEqual(DEFAULT_LIBRARY.calendar);
  });

  it("refuses past the schedule cap", () => {
    let library: Library = { schedules: [], calendar: DEFAULT_LIBRARY.calendar };
    for (let n = 0; n < SCHEDULE_LIMITS.schedules; n++) library = createSchedule(library, `S${n}`);

    expect(addSchedule(library, shared)).toBe(library);
  });
});

describe("replaceLibrary", () => {
  it("replaces the schedules and the calendar together", () => {
    const backup = parseLibrary(
      '{"schedules":[{"id":"only","name":"Only","periods":[]}],"calendar":{"weekdays":[null,"only",null,null,null,null,null],"overrides":[]}}',
    );
    if (!backup.ok) throw new Error("fixture should parse");

    const next = replaceLibrary(DEFAULT_LIBRARY, backup.value);

    expect(next.schedules.map((entry) => entry.name)).toEqual(["Only"]);
    expect(next.calendar.weekdays[1]).toBe("only");
    // Wednesday pointed at "regular", which the backup does not contain.
    expect(next.calendar.weekdays[3]).toBeNull();
  });

  it("runs an imported library through the same boundary as a typed one", () => {
    // Not taken at its word: ids are minted and caps applied on the way in.
    const next = replaceLibrary(DEFAULT_LIBRARY, {
      schedules: [],
      calendar: DEFAULT_LIBRARY.calendar,
    });

    expect(next.schedules).toEqual([]);
    expect(next.calendar.weekdays).toEqual([null, null, null, null, null, null, null]);
  });

  it("survives a round trip through export and import", () => {
    const edited = setOverride(setWeekday(DEFAULT_LIBRARY, 3, "delayed"), "2026-09-14", "assembly");

    const exported = serializeLibrary(edited);
    const imported = parseLibrary(exported);
    if (!imported.ok) throw new Error("a library BellTab exported must import");

    expect(replaceLibrary(DEFAULT_LIBRARY, imported.value)).toEqual(edited);
  });
});

describe("past exceptions", () => {
  // Three exceptions around a fixed "today": one before, one on the day, one
  // after. ISO dates compare as strings, which is the whole trick.
  const today = "2026-09-14";
  const withThree = setOverride(
    setOverride(setOverride(DEFAULT_LIBRARY, "2026-09-01", null), today, "regular"),
    "2026-10-01",
    null,
  );

  it("names only the exceptions strictly before today", () => {
    expect(pastOverrides(withThree, today).map((entry) => entry.date)).toEqual(["2026-09-01"]);
  });

  it("removes exactly those, keeping today's own exception because it is still running", () => {
    const pruned = removePastOverrides(withThree, today);

    expect(pruned.calendar.overrides.map((entry) => entry.date)).toEqual([today, "2026-10-01"]);
    expect(pastOverrides(pruned, today)).toEqual([]);
  });

  it("is a no-op on a calendar with nothing in the past", () => {
    expect(removePastOverrides(DEFAULT_LIBRARY, today)).toEqual(DEFAULT_LIBRARY);
  });
});
