/**
 * The hard-coded schedule for Phase 2.
 *
 * This file is data only - no logic, no clock, no DOM. Later it gets replaced
 * by a schedule the user edits and by one decoded from a share link, but the
 * SHAPE below is the contract that everything downstream is written against.
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

export const schedule = {
  name: "Regular day",

  /**
   * Sorted by start time, and no two periods overlap. Both are guaranteed
   * here by hand; from Phase 3 on, a parser at the boundary enforces them so
   * that no code past that point ever has to re-check.
   *
   * GAPS ARE LEGAL and deliberately so - the time before 8:00 and after 14:30
   * belongs to no period. Those are real states the UI has to render ("school
   * starts in 1h 12m", "school's out"), not holes to be patched.
   */
  periods: [
    { name: "Period 1", startMin: hm(8, 0), endMin: hm(8, 55) },
    { name: "Passing", startMin: hm(8, 55), endMin: hm(9, 5) },
    { name: "Period 2", startMin: hm(9, 5), endMin: hm(10, 5) },
    { name: "Passing", startMin: hm(10, 5), endMin: hm(10, 10) },
    { name: "Period 3", startMin: hm(10, 10), endMin: hm(11, 5) },
    { name: "A Lunch", startMin: hm(11, 5), endMin: hm(11, 35) },
    { name: "Period 4", startMin: hm(11, 35), endMin: hm(12, 30) },
    { name: "Passing", startMin: hm(12, 30), endMin: hm(12, 35) },
    { name: "Period 5", startMin: hm(12, 35), endMin: hm(13, 30) },
    { name: "Passing", startMin: hm(13, 30), endMin: hm(13, 35) },
    { name: "Period 6", startMin: hm(13, 35), endMin: hm(14, 30) },
  ],
};
