/**
 * Seed data: the schedules a fresh install starts with, and the calendar that
 * says which one runs on which day.
 *
 * This file is data only - no logic, no clock, no DOM. Everything here is a
 * DEFAULT: once the user edits anything, the edited copy lives in localStorage
 * and this file is only ever read again on a reset.
 */

/**
 * Converts a wall-clock time to minutes since midnight.
 *
 * Times in BellTab are plain integers, never Date objects: a bell schedule is
 * wall-clock ("Period 2 starts at 9:05"), so 545 is DST-safe, trivially
 * comparable, and trivially serializable. Subtracting two integers cannot
 * drift; subtracting two Dates across a DST boundary can.
 */
const hm = (hours, minutes) => hours * 60 + minutes;

/**
 * What a period *is*, as opposed to what it is called.
 *
 * The period strip needs to know which blocks are the day's real units and
 * which are the seams between them, and it cannot learn that from the label -
 * a school might call passing "Transition", or name a class "Passing Period
 * Prep". `kind` is the schedule's own answer, set by whoever authored it.
 */
export const PERIOD_KINDS = {
  CLASS: "class",
  LUNCH: "lunch",
  PASSING: "passing",
};

/**
 * Every schedule below obeys the same invariants, enforced from here on by
 * parseSchedule: sorted by start, startMin < endMin, and NO OVERLAPS.
 *
 * Gaps are legal and deliberate - before the first bell and after the last
 * belongs to no period, and those are real states the UI renders rather than
 * holes to be patched.
 */
export const DEFAULT_SCHEDULES = [
  {
    id: "regular",
    name: "Regular",
    periods: [
      { name: "Period 1", kind: "class", startMin: hm(8, 0), endMin: hm(8, 55) },
      { name: "Passing", kind: "passing", startMin: hm(8, 55), endMin: hm(9, 5) },
      { name: "Period 2", kind: "class", startMin: hm(9, 5), endMin: hm(10, 5) },
      { name: "Passing", kind: "passing", startMin: hm(10, 5), endMin: hm(10, 10) },
      { name: "Period 3", kind: "class", startMin: hm(10, 10), endMin: hm(11, 5) },
      { name: "A Lunch", kind: "lunch", startMin: hm(11, 5), endMin: hm(11, 35) },
      { name: "Period 4", kind: "class", startMin: hm(11, 35), endMin: hm(12, 30) },
      { name: "Passing", kind: "passing", startMin: hm(12, 30), endMin: hm(12, 35) },
      { name: "Period 5", kind: "class", startMin: hm(12, 35), endMin: hm(13, 30) },
      { name: "Passing", kind: "passing", startMin: hm(13, 30), endMin: hm(13, 35) },
      { name: "Period 6", kind: "class", startMin: hm(13, 35), endMin: hm(14, 30) },
    ],
  },
  {
    // A two-hour delay that still dismisses at the usual time - which is what
    // makes it a genuinely different schedule rather than the regular one
    // shifted, and why "duplicate and tweak" is the primary authoring move.
    id: "delayed",
    name: "Delayed start",
    periods: [
      { name: "Period 1", kind: "class", startMin: hm(10, 0), endMin: hm(10, 45) },
      { name: "Passing", kind: "passing", startMin: hm(10, 45), endMin: hm(10, 50) },
      { name: "Period 2", kind: "class", startMin: hm(10, 50), endMin: hm(11, 35) },
      { name: "A Lunch", kind: "lunch", startMin: hm(11, 35), endMin: hm(12, 5) },
      { name: "Period 3", kind: "class", startMin: hm(12, 5), endMin: hm(12, 50) },
      { name: "Passing", kind: "passing", startMin: hm(12, 50), endMin: hm(12, 55) },
      { name: "Period 4", kind: "class", startMin: hm(12, 55), endMin: hm(13, 40) },
      { name: "Passing", kind: "passing", startMin: hm(13, 40), endMin: hm(13, 45) },
      { name: "Period 5", kind: "class", startMin: hm(13, 45), endMin: hm(14, 30) },
    ],
  },
  {
    // No lunch: the day ends before it. A schedule with no `lunch` period at
    // all is normal, not a data error.
    id: "half",
    name: "Half day",
    periods: [
      { name: "Period 1", kind: "class", startMin: hm(8, 0), endMin: hm(8, 40) },
      { name: "Passing", kind: "passing", startMin: hm(8, 40), endMin: hm(8, 45) },
      { name: "Period 2", kind: "class", startMin: hm(8, 45), endMin: hm(9, 25) },
      { name: "Passing", kind: "passing", startMin: hm(9, 25), endMin: hm(9, 30) },
      { name: "Period 3", kind: "class", startMin: hm(9, 30), endMin: hm(10, 10) },
      { name: "Passing", kind: "passing", startMin: hm(10, 10), endMin: hm(10, 15) },
      { name: "Period 4", kind: "class", startMin: hm(10, 15), endMin: hm(10, 55) },
      { name: "Passing", kind: "passing", startMin: hm(10, 55), endMin: hm(11, 0) },
      { name: "Period 5", kind: "class", startMin: hm(11, 0), endMin: hm(11, 40) },
    ],
  },
  {
    id: "assembly",
    name: "Assembly",
    periods: [
      { name: "Period 1", kind: "class", startMin: hm(8, 0), endMin: hm(8, 55) },
      { name: "Passing", kind: "passing", startMin: hm(8, 55), endMin: hm(9, 5) },
      { name: "Assembly", kind: "class", startMin: hm(9, 5), endMin: hm(10, 5) },
      { name: "Passing", kind: "passing", startMin: hm(10, 5), endMin: hm(10, 10) },
      { name: "Period 2", kind: "class", startMin: hm(10, 10), endMin: hm(11, 5) },
      { name: "A Lunch", kind: "lunch", startMin: hm(11, 5), endMin: hm(11, 35) },
      { name: "Period 3", kind: "class", startMin: hm(11, 35), endMin: hm(12, 30) },
      { name: "Passing", kind: "passing", startMin: hm(12, 30), endMin: hm(12, 35) },
      { name: "Period 4", kind: "class", startMin: hm(12, 35), endMin: hm(13, 30) },
      { name: "Passing", kind: "passing", startMin: hm(13, 30), endMin: hm(13, 35) },
      { name: "Period 5", kind: "class", startMin: hm(13, 35), endMin: hm(14, 30) },
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
export const DEFAULT_CALENDAR = {
  weekdays: [null, "regular", "regular", "regular", "regular", "regular", null],
  overrides: [],
};
