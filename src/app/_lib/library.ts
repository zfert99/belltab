import { parseCalendar, parseScheduleCollection } from "@/lib/parse";
import {
  DEFAULT_CALENDAR,
  DEFAULT_SCHEDULES,
  type Calendar,
  type ScheduleId,
  type ValidSchedule,
} from "@/lib/schedule";

/**
 * Everything the app knows: the schedules that exist, and which day runs which.
 *
 * Phase 2 froze this at `DEFAULT_SCHEDULES` inside `today.ts`. Phase 3 makes it
 * a value the editor can replace and `localStorage` can persist, so it moved
 * here and became a parameter rather than a module constant.
 *
 * Everything in this file is pure. The `localStorage` calls live in
 * `useLibrary.ts`; what is here is the parsing and serialising either side of
 * them, which is the half worth testing.
 */

export interface Library {
  schedules: readonly ValidSchedule[];
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

const idsOf = (schedules: readonly ValidSchedule[]): readonly ScheduleId[] =>
  schedules.map((schedule) => schedule.id).filter((id): id is ScheduleId => id !== null);

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
const defaultSchedules: readonly ValidSchedule[] = parsedDefaults.ok ? parsedDefaults.value : [];

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

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return DEFAULT_LIBRARY;
  }

  if (typeof decoded !== "object" || decoded === null) return DEFAULT_LIBRARY;

  const source = decoded as { schedules?: unknown; calendar?: unknown };
  const schedules = parseScheduleCollection(source.schedules);
  if (!schedules.ok) return DEFAULT_LIBRARY;

  return {
    schedules: schedules.value,
    calendar: parseCalendar(source.calendar, idsOf(schedules.value)),
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
