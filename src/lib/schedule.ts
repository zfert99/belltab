/**
 * What a schedule *is*, and the schedules a fresh install starts with.
 *
 * Two things live here because they are the same statement twice: the types
 * are the vocabulary, and `DEFAULT_SCHEDULES` is the canonical example of it.
 * There is no logic, no clock and no DOM - everything below is either a type
 * or a DEFAULT. Once the user edits anything, the edited copy lives in
 * localStorage and this file is only ever read again on a reset.
 */

/**
 * Converts a wall-clock time to minutes since midnight.
 *
 * Times in BellTab are plain integers, never Date objects: a bell schedule is
 * wall-clock ("Period 2 starts at 9:05"), so 545 is DST-safe, trivially
 * comparable, and trivially serializable. Subtracting two integers cannot
 * drift; subtracting two Dates across a DST boundary can.
 */
const hm = (hours: number, minutes: number): number => hours * 60 + minutes;

/**
 * What a period *is*, as opposed to what it is called.
 *
 * Descriptive, and nothing more: a category the schedule's author gives each
 * block, shown in the editor and carried in share links and backups. The
 * engine no longer reads it. It once did - the retired Day view's "3 of 7"
 * counter skipped Passing periods as the seams between blocks - and that
 * counter was deleted on 2026-09-03 along with the rest of that view's
 * residue, so "is this Passing?" is a question nothing asks any more. If a
 * strip or a counter is ever rebuilt, this is where the semantic would return.
 *
 * **Free text since 2026-09-03**, with these as suggestions rather than the
 * whole menu. A closed list of three could not say "Planning", "Advisory" or
 * whatever a building calls its own blocks - so the list is a datalist, the
 * canonical spelling of each built-in is what the parser normalises legacy
 * lowercase values to, and anything else a user types is kept as typed.
 */
export const PERIOD_KINDS = {
  CLASS: "Class",
  LUNCH: "Lunch",
  PASSING: "Passing",
  PLANNING: "Planning",
  ADVISORY: "Advisory",
  HOMEROOM: "Homeroom",
  BREAK: "Break",
  ASSEMBLY: "Assembly",
} as const;

/** One of the built-ins, for the places that want to enumerate them. */
export type BuiltInKind = (typeof PERIOD_KINDS)[keyof typeof PERIOD_KINDS];

/**
 * Any kind at all, built-in or the user's own. `string` rather than the union,
 * on purpose: the parser is the only thing that constrains it, and a schedule
 * with a kind called "Study hall" is a valid schedule.
 */
export type PeriodKind = string;

/** The built-ins in the order the editor offers them. */
export const BUILT_IN_KINDS: readonly BuiltInKind[] = Object.values(PERIOD_KINDS);

/**
 * A minute of the day, 0 to 1440.
 *
 * An alias rather than a brand: every integer in range is a legal value, so a
 * brand would buy no safety and cost a cast at every arithmetic site. It
 * exists to make signatures read as intent - `startMin: MinuteOfDay` says what
 * `startMin: number` does not.
 */
export type MinuteOfDay = number;

/** A date on a wall calendar, "YYYY-MM-DD". Minted by `parseIsoDate`. */
export type IsoDate = string;

/** A schedule's stable identity, used by the calendar to point at it. */
export type ScheduleId = string;

export interface Period {
  name: string;
  kind: PeriodKind;
  startMin: MinuteOfDay;
  endMin: MinuteOfDay;
}

export interface Schedule {
  id: ScheduleId | null;
  name: string;
  periods: readonly Period[];
}

/**
 * The brand that makes "parse, don't validate" a compiler rule rather than a
 * convention.
 *
 * The symbol is deliberately NOT exported. A `ValidSchedule` can be held,
 * passed and read anywhere, but the only honest way to obtain one is
 * `parseSchedule` - nothing downstream can name the brand in order to forge
 * it, so nothing downstream needs to re-check ordering or overlap.
 *
 * The guarantee it carries: periods sorted by start, `startMin < endMin` on
 * every one, and no two overlapping. Gaps are legal and are NOT part of the
 * guarantee - a schedule need not tile the day.
 */
declare const validScheduleBrand: unique symbol;

export type ValidSchedule = Schedule & { readonly [validScheduleBrand]: true };

/** One weekday's default, indexed 0 = Sunday through 6 = Saturday. */
export type WeekdayMap = readonly [
  ScheduleId | null,
  ScheduleId | null,
  ScheduleId | null,
  ScheduleId | null,
  ScheduleId | null,
  ScheduleId | null,
  ScheduleId | null,
];

export interface CalendarOverride {
  date: IsoDate;
  /** `null` is an explicit closure - a snow day - not a missing entry. */
  scheduleId: ScheduleId | null;
}

export interface Calendar {
  weekdays: WeekdayMap;
  overrides: readonly CalendarOverride[];
}

/**
 * Every schedule below obeys the same invariants, enforced from here on by
 * parseSchedule: sorted by start, startMin < endMin, and NO OVERLAPS.
 *
 * Gaps are legal and deliberate - before the first bell and after the last
 * belongs to no period, and those are real states the UI renders rather than
 * holes to be patched.
 *
 * Typed as plain `Schedule`, not `ValidSchedule`. Seed data gets no exemption
 * from the boundary: `parse.test.ts` runs all four through `parseSchedule`, so
 * a typo here fails the suite rather than shipping as a broken default.
 */
export const DEFAULT_SCHEDULES: readonly Schedule[] = [
  {
    id: "regular",
    name: "Regular",
    periods: [
      { name: "Period 1", kind: "Class", startMin: hm(8, 0), endMin: hm(8, 55) },
      { name: "Passing", kind: "Passing", startMin: hm(8, 55), endMin: hm(9, 5) },
      { name: "Period 2", kind: "Class", startMin: hm(9, 5), endMin: hm(10, 5) },
      { name: "Passing", kind: "Passing", startMin: hm(10, 5), endMin: hm(10, 10) },
      { name: "Period 3", kind: "Class", startMin: hm(10, 10), endMin: hm(11, 5) },
      { name: "A Lunch", kind: "Lunch", startMin: hm(11, 5), endMin: hm(11, 35) },
      { name: "Period 4", kind: "Class", startMin: hm(11, 35), endMin: hm(12, 30) },
      { name: "Passing", kind: "Passing", startMin: hm(12, 30), endMin: hm(12, 35) },
      { name: "Period 5", kind: "Class", startMin: hm(12, 35), endMin: hm(13, 30) },
      { name: "Passing", kind: "Passing", startMin: hm(13, 30), endMin: hm(13, 35) },
      { name: "Period 6", kind: "Class", startMin: hm(13, 35), endMin: hm(14, 30) },
    ],
  },
  {
    // A two-hour delay that still dismisses at the usual time - which is what
    // makes it a genuinely different schedule rather than the regular one
    // shifted, and why "duplicate and tweak" is the primary authoring move.
    id: "delayed",
    name: "Delayed start",
    periods: [
      { name: "Period 1", kind: "Class", startMin: hm(10, 0), endMin: hm(10, 45) },
      { name: "Passing", kind: "Passing", startMin: hm(10, 45), endMin: hm(10, 50) },
      { name: "Period 2", kind: "Class", startMin: hm(10, 50), endMin: hm(11, 35) },
      { name: "A Lunch", kind: "Lunch", startMin: hm(11, 35), endMin: hm(12, 5) },
      { name: "Period 3", kind: "Class", startMin: hm(12, 5), endMin: hm(12, 50) },
      { name: "Passing", kind: "Passing", startMin: hm(12, 50), endMin: hm(12, 55) },
      { name: "Period 4", kind: "Class", startMin: hm(12, 55), endMin: hm(13, 40) },
      { name: "Passing", kind: "Passing", startMin: hm(13, 40), endMin: hm(13, 45) },
      { name: "Period 5", kind: "Class", startMin: hm(13, 45), endMin: hm(14, 30) },
    ],
  },
  {
    // No lunch: the day ends before it. A schedule with no `lunch` period at
    // all is normal, not a data error.
    id: "half",
    name: "Half day",
    periods: [
      { name: "Period 1", kind: "Class", startMin: hm(8, 0), endMin: hm(8, 40) },
      { name: "Passing", kind: "Passing", startMin: hm(8, 40), endMin: hm(8, 45) },
      { name: "Period 2", kind: "Class", startMin: hm(8, 45), endMin: hm(9, 25) },
      { name: "Passing", kind: "Passing", startMin: hm(9, 25), endMin: hm(9, 30) },
      { name: "Period 3", kind: "Class", startMin: hm(9, 30), endMin: hm(10, 10) },
      { name: "Passing", kind: "Passing", startMin: hm(10, 10), endMin: hm(10, 15) },
      { name: "Period 4", kind: "Class", startMin: hm(10, 15), endMin: hm(10, 55) },
      { name: "Passing", kind: "Passing", startMin: hm(10, 55), endMin: hm(11, 0) },
      { name: "Period 5", kind: "Class", startMin: hm(11, 0), endMin: hm(11, 40) },
    ],
  },
  {
    id: "assembly",
    name: "Assembly",
    periods: [
      { name: "Period 1", kind: "Class", startMin: hm(8, 0), endMin: hm(8, 55) },
      { name: "Passing", kind: "Passing", startMin: hm(8, 55), endMin: hm(9, 5) },
      { name: "Assembly", kind: "Class", startMin: hm(9, 5), endMin: hm(10, 5) },
      { name: "Passing", kind: "Passing", startMin: hm(10, 5), endMin: hm(10, 10) },
      { name: "Period 2", kind: "Class", startMin: hm(10, 10), endMin: hm(11, 5) },
      { name: "A Lunch", kind: "Lunch", startMin: hm(11, 5), endMin: hm(11, 35) },
      { name: "Period 3", kind: "Class", startMin: hm(11, 35), endMin: hm(12, 30) },
      { name: "Passing", kind: "Passing", startMin: hm(12, 30), endMin: hm(12, 35) },
      { name: "Period 4", kind: "Class", startMin: hm(12, 35), endMin: hm(13, 30) },
      { name: "Passing", kind: "Passing", startMin: hm(13, 30), endMin: hm(13, 35) },
      { name: "Period 5", kind: "Class", startMin: hm(13, 35), endMin: hm(14, 30) },
    ],
  },
];

/**
 * Which schedule runs on which day.
 *
 * `weekdays` is indexed by JS weekday number, 0 = Sunday through 6 = Saturday,
 * so it can be indexed directly with Date.prototype.getDay() and no lookup
 * table sits between the two. `null` means no school - the weekend is a real
 * answer, not a missing one.
 *
 * `overrides` are one-off dates that beat the weekday map. Dates are
 * "YYYY-MM-DD" strings in LOCAL wall-clock terms, for the same reason times
 * are integers: a school day is a date on a wall calendar, not an instant, and
 * an ISO timestamp would drag a timezone into a question that has none.
 * A `scheduleId` of null is an explicit closure - a snow day.
 */
export const DEFAULT_CALENDAR: Calendar = {
  weekdays: [null, "regular", "regular", "regular", "regular", "regular", null],
  overrides: [],
};
