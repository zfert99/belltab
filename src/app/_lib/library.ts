import {
  SCHEDULE_LIMITS,
  parseCalendar,
  parseIsoDate,
  parseScheduleCollection,
  type IdentifiedSchedule,
  type ParseResult,
} from "@/lib/parse";
import {
  DEFAULT_CALENDAR,
  DEFAULT_SCHEDULES,
  type Calendar,
  type IsoDate,
  type Schedule,
  type ScheduleId,
  type CalendarOverride,
} from "@/lib/schedule";

/**
 * Everything the app knows: the schedules that exist, and which day runs which.
 *
 * Phase 2 froze this at `DEFAULT_SCHEDULES` inside `today.ts`. Phase 3 makes it
 * a value the editor can replace and `localStorage` can persist, so it moved
 * here and became a parameter rather than a module constant.
 *
 * Everything in this file is pure. The `localStorage` calls live in
 * `libraryStore.ts`; what is here is the parsing and serialising either side of
 * them - and, since Phase 4, every structural change to the library itself.
 *
 * The mutators at the bottom are functions from a library to a library. None of
 * them reads a clock, a store or a DOM, so the whole of "what happens when you
 * delete a schedule the calendar points at" is testable without a browser.
 */

/**
 * Schedules here are `IdentifiedSchedule`, not `ValidSchedule`: the calendar
 * points at them by id, so a library schedule without one could never be
 * scheduled. `parseScheduleCollection` is what guarantees it.
 */
export interface Library {
  schedules: readonly IdentifiedSchedule[];
  calendar: Calendar;
}

/**
 * The storage key, versioned from the first write.
 *
 * `AGENTS.md` requires a version marker on the share payload and the same logic
 * applies here: whatever shape ships today is a shape some browser will still
 * be holding in a year. The version lives in the KEY rather than inside the
 * value, so a v2 reader does not have to parse v1's bytes to discover it cannot
 * read them - it looks for its own key, misses, and starts clean.
 *
 * Never repurpose a number. `belltab.v2` means a new shape, not a bug fix.
 */
export const STORAGE_KEY = "belltab.v1";

const idsOf = (schedules: readonly IdentifiedSchedule[]): readonly ScheduleId[] =>
  schedules.map((schedule) => schedule.id);

/**
 * The library a fresh install starts with, parsed at the boundary.
 *
 * Seed data gets no exemption: `parseSchedule` is the only thing that can mint
 * a `ValidSchedule`, and a typo in `schedule.ts` should fail the suite rather
 * than ship. A failure here degrades to an empty library, which renders the
 * onboarding empty state - a floor, not an expectation, since `parse.test.ts`
 * proves all four defaults parse.
 */
const parsedDefaults = parseScheduleCollection(DEFAULT_SCHEDULES);
const defaultSchedules: readonly IdentifiedSchedule[] = parsedDefaults.ok
  ? parsedDefaults.value
  : [];

export const DEFAULT_LIBRARY: Library = {
  schedules: defaultSchedules,
  calendar: parseCalendar(DEFAULT_CALENDAR, idsOf(defaultSchedules)),
};

/**
 * A stored string to a library, or the defaults.
 *
 * Takes the raw string rather than reading `localStorage` itself, so it is a
 * pure function of its input and testable without a DOM.
 *
 * EVERY failure path lands on the defaults rather than throwing: absent,
 * unparseable JSON, the wrong shape, a schedule that no longer validates.
 * `AGENTS.md` is explicit that a corrupt value must degrade to a clean state
 * and never crash - this is a cache of the user's own choices, not a source of
 * truth, and a tab that will not open because of a bad byte is worse than one
 * that opens on the seeded schedules.
 *
 * The calendar is deliberately NOT all-or-nothing: `parseCalendar` cannot fail,
 * because a weekday pointing at a deleted schedule degrades to "no school",
 * which is a screen the app already renders properly.
 */
export function loadLibrary(raw: string | null): Library {
  if (raw === null) return DEFAULT_LIBRARY;

  const parsed = parseLibrary(raw);
  return parsed.ok ? parsed.value : DEFAULT_LIBRARY;
}

/**
 * The same parse, but it TELLS YOU when it fails.
 *
 * `loadLibrary` swallows every error on purpose - a corrupt `localStorage` value
 * must degrade to a clean state rather than refuse to open the app. An IMPORT is
 * the opposite situation: the user picked that file deliberately, and silently
 * replacing their library with the seed data because a byte was wrong would be
 * the worst possible answer.
 *
 * So the parsing lives here, once, and the two callers differ only in what they
 * do with a failure. The errors are worded for somebody who just chose a file.
 */
export function parseLibrary(raw: string): ParseResult<Library> {
  const fail = (message: string): ParseResult<Library> => ({
    ok: false,
    errors: [{ index: null, field: "library", message }],
  });

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return fail("That file is not JSON. A BellTab backup is the file the Export button writes.");
  }

  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    return fail("That file is JSON, but it is not a BellTab backup.");
  }

  const source = decoded as { schedules?: unknown; calendar?: unknown };
  const schedules = parseScheduleCollection(source.schedules);
  if (!schedules.ok) {
    return fail(`That backup has a schedule BellTab cannot read: ${schedules.errors[0].message}`);
  }

  return {
    ok: true,
    value: {
      schedules: schedules.value,
      // Deliberately not all-or-nothing, exactly as on load: a calendar
      // pointing at a schedule the backup does not contain degrades to "no
      // school", which is a screen the app renders properly.
      calendar: parseCalendar(source.calendar, idsOf(schedules.value)),
    },
  };
}

/**
 * A library to the string that goes in `localStorage`.
 *
 * Plain, readable JSON - the same shape the Phase 5 export writes, so a user
 * who opens devtools sees the file they could have exported. No compression:
 * this is hundreds of bytes and it is never sent anywhere.
 */
export function serializeLibrary(library: Library): string {
  return JSON.stringify({ schedules: library.schedules, calendar: library.calendar });
}

/**
 * The name a schedule is born with, so the picker never shows a blank chip.
 * `parseSchedule` refuses an empty name, so this is also what makes creating a
 * schedule from nothing possible at all.
 */
const NEW_SCHEDULE_NAME = "New schedule";

/**
 * The library, rebuilt through the boundary.
 *
 * Every structural change goes through here rather than splicing
 * `ValidSchedule`s around, and that buys three things at once: ids are minted
 * for anything new, the schedule cap is enforced, and the calendar is re-pointed
 * at the ids that still exist - so a weekday aimed at a deleted schedule becomes
 * "no school" instead of dangling.
 *
 * Returns the library UNCHANGED when the boundary refuses the input. Every
 * caller below builds something the parser accepts, so this is a floor rather
 * than an expectation; the alternative is a mutator that can return half a
 * library, which is the thing "parse, don't validate" exists to prevent.
 */
function rebuild(schedules: readonly unknown[], calendar: unknown, fallback: Library): Library {
  const parsed = parseScheduleCollection(schedules);
  if (!parsed.ok) return fallback;

  return { schedules: parsed.value, calendar: parseCalendar(calendar, idsOf(parsed.value)) };
}

/** The calendar re-parsed against the schedules that exist. */
function withCalendar(library: Library, calendar: unknown): Library {
  return { ...library, calendar: parseCalendar(calendar, idsOf(library.schedules)) };
}

/**
 * "Regular" to "Regular (copy)", within the name cap.
 *
 * The truncation is load-bearing rather than tidy: `parseSchedule` refuses a
 * name over `SCHEDULE_LIMITS.nameChars`, so appending to a name already at the
 * cap would make the whole duplicate silently fail to parse and the button do
 * nothing at all.
 */
function copyName(name: string): string {
  const suffix = " (copy)";
  const room = SCHEDULE_LIMITS.nameChars - suffix.length;
  return `${name.length > room ? name.slice(0, room).trimEnd() : name}${suffix}`;
}

/**
 * A new, empty schedule, appended.
 *
 * Empty rather than pre-filled with a period nobody asked for: "This schedule
 * has no periods" is a state the countdown already renders honestly, and the
 * editor's Add period button starts an empty draft at 08:00. Appended rather
 * than inserted, because the picker is positional and a chip arriving in the
 * middle would move every other chip out from under the pointer.
 *
 * At the schedule cap this is a no-op; the picker disables the control there, so
 * the guard is a floor rather than the message.
 */
export function createSchedule(library: Library, name: string = NEW_SCHEDULE_NAME): Library {
  if (library.schedules.length >= SCHEDULE_LIMITS.schedules) return library;

  return rebuild([...library.schedules, { name, periods: [] }], library.calendar, library);
}

/**
 * The schedule at `index`, copied in beside it - the primary authoring move.
 *
 * The copy carries the source's id into `rebuild`, and that is deliberate: the
 * ORIGINAL comes first in the list, so it keeps the id and the boundary mints
 * the copy a fresh one. One place in the codebase decides what an id is, and the
 * duplicate path exercises it rather than working around it.
 *
 * The calendar is untouched, so a duplicate runs on no day until it is pointed
 * at one. Silently inheriting the original's weekdays would be a schedule change
 * nobody asked for, on days that already work.
 */
export function duplicateSchedule(library: Library, index: number): Library {
  const source = library.schedules[index];
  if (source === undefined || library.schedules.length >= SCHEDULE_LIMITS.schedules) return library;

  const copy = { ...source, name: copyName(source.name) };
  const schedules = [
    ...library.schedules.slice(0, index + 1),
    copy,
    ...library.schedules.slice(index + 1),
  ];

  return rebuild(schedules, library.calendar, library);
}

/**
 * The schedule at `index`, gone, and the calendar re-pointed.
 *
 * Weekdays aiming at it fall back to "no school" through `parseCalendar`, which
 * is a screen the app already renders. Overrides aiming at it are DROPPED here
 * first, because `parseCalendar` would turn them into `scheduleId: null` - an
 * explicit closure - and quietly inventing a snow day on a date the user had
 * marked as an assembly is worse than letting that date fall back to its weekday
 * default.
 *
 * Deleting the last schedule is legal, and lands on the onboarding empty state.
 */
export function deleteSchedule(library: Library, index: number): Library {
  const target = library.schedules[index];
  if (target === undefined) return library;

  const schedules = library.schedules.filter((_, at) => at !== index);
  const overrides = library.calendar.overrides.filter((entry) => entry.scheduleId !== target.id);

  return rebuild(schedules, { ...library.calendar, overrides }, library);
}

/**
 * One weekday's default. `null` is "no school", which is an answer rather than
 * a missing value - the weekend is the ordinary case for it.
 */
export function setWeekday(
  library: Library,
  weekday: number,
  scheduleId: ScheduleId | null,
): Library {
  const weekdays = library.calendar.weekdays.map((current, day) =>
    day === weekday ? scheduleId : current,
  );

  return withCalendar(library, { ...library.calendar, weekdays });
}

/**
 * An explicit date override, replacing any existing entry for that date.
 *
 * Replacing rather than appending is what keeps the resolver from having to
 * arbitrate between two entries for one day. `parseCalendar` collapses
 * duplicates on load as well, so both paths agree.
 *
 * A `scheduleId` of `null` is a closure - a snow day - and is the whole reason
 * the resolver checks for the ENTRY rather than for its value.
 *
 * **Two guards, both of which refuse rather than appear to succeed.** Between
 * this shipping and the Phase 4 review, neither was here and both failure modes
 * were silent - see `Docs/code-review-2026-09-01.md`, findings 1 and 2.
 *
 * `IsoDate` is a bare `string` alias, so a date that is not one reaches this
 * function typed correctly and is dropped later by `parseCalendar`, leaving a
 * caller that saw a new library and no error. Parsing here means the caller can
 * tell the difference.
 *
 * The cap check is on `others`, not on the current list, and that distinction is
 * the whole point: replacing an entry for a date that already exists cannot grow
 * the calendar, so it stays legal at the cap. Only a genuinely NEW date is
 * refused. `parseCalendar` enforces the same cap by keeping the FIRST 400, which
 * discards the entry being added rather than an old one - correct for an
 * untrusted payload, useless as flow control for a button.
 */
export function setOverride(
  library: Library,
  date: IsoDate,
  scheduleId: ScheduleId | null,
): Library {
  const validDate = parseIsoDate(date);
  if (validDate === null) return library;

  const others = library.calendar.overrides.filter((entry) => entry.date !== validDate);
  if (others.length >= SCHEDULE_LIMITS.overrides) return library;

  return withCalendar(library, {
    ...library.calendar,
    overrides: [...others, { date: validDate, scheduleId }],
  });
}

/**
 * The dated exceptions that can never resolve again: strictly before today.
 *
 * ISO dates compare correctly as strings, which is the one nice property of
 * the format and the reason the resolver never needed a `Date` either.
 */
export function pastOverrides(library: Library, today: IsoDate): readonly CalendarOverride[] {
  return library.calendar.overrides.filter((entry) => entry.date < today);
}

/**
 * Every exception before today, removed at once.
 *
 * The cap is 400 and nothing pruned automatically - a user two years in has a
 * list of dates that will never resolve and one Remove button per row. This is
 * the same operation as `removeOverride`, applied to the set `pastOverrides`
 * names; today's own exception is kept, because it is still running.
 */
export function removePastOverrides(library: Library, today: IsoDate): Library {
  return withCalendar(library, {
    ...library.calendar,
    overrides: library.calendar.overrides.filter((entry) => entry.date >= today),
  });
}

/** An override removed, so the date falls back to its weekday default. */
export function removeOverride(library: Library, date: IsoDate): Library {
  return withCalendar(library, {
    ...library.calendar,
    overrides: library.calendar.overrides.filter((entry) => entry.date !== date),
  });
}

/**
 * A schedule from OUTSIDE this library, appended.
 *
 * The route a share link takes. It goes through `rebuild` like every other
 * structural change, which is what mints it an id that cannot collide with one
 * the recipient already has - the sender's id was dropped at the encoder, and
 * even a hand-crafted link claiming `regular` gets renumbered here because the
 * existing schedule claims it first.
 *
 * The calendar is untouched. A schedule somebody sent you runs on no day until
 * you say so, which is the same rule `duplicateSchedule` follows and for the
 * same reason.
 */
export function addSchedule(library: Library, schedule: Schedule): Library {
  if (library.schedules.length >= SCHEDULE_LIMITS.schedules) return library;

  return rebuild(
    [...library.schedules, { ...schedule, id: null }],
    library.calendar,
    library,
  );
}

/**
 * A whole library, replacing the one that is there.
 *
 * Import is the one genuinely destructive action in the app - it discards every
 * schedule and the entire calendar - which is why the UI puts a confirmation in
 * front of it. This function does not: it is the mutator, and guarding it here
 * as well would put the warning somewhere the user cannot read it.
 *
 * Runs through `rebuild` rather than being taken at its word, so an imported
 * library gets the same id and cap guarantees as one that was typed.
 */
export function replaceLibrary(library: Library, next: Library): Library {
  return rebuild(next.schedules, next.calendar, library);
}
