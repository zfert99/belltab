import { describe, expect, it } from "vitest";
import { DEFAULT_LIBRARY, loadLibrary, serializeLibrary } from "@/app/_lib/library";

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
    ["a period with no name", '{"schedules":[{"name":"X","periods":[{"kind":"class","startMin":0,"endMin":5}]}]}'],
    [
      "two periods that overlap",
      '{"schedules":[{"name":"X","periods":[{"name":"A","kind":"class","startMin":0,"endMin":60},{"name":"B","kind":"class","startMin":30,"endMin":90}]}]}',
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
      kind: "class",
      startMin: 480,
      endMin: 535,
    });
  });
});
