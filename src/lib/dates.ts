/**
 * The weekday of a calendar date, from its ISO string, without a `Date`.
 *
 * The obvious `new Date("2026-09-14").getDay()` is wrong by up to a day: a
 * date-only ISO string is parsed as UTC midnight, and `getDay` answers in the
 * device's zone - so west of Greenwich the evening before comes back. The
 * dated exceptions are wall-clock days, like everything else in this app, and
 * a wall-clock day's weekday is arithmetic on three integers.
 *
 * Sakamoto's method; returns `null` for anything that is not `YYYY-MM-DD`.
 */
export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

export function weekdayOf(isoDate: string): WeekdayName | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (match === null) return null;

  let year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // January and February count as months 13 and 14 of the previous year, so
  // the leap day lands at the end of the "year" the table below is built for.
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (month < 3) year -= 1;

  const index =
    (year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400) + offsets[month - 1] + day) % 7;

  return WEEKDAY_NAMES[index];
}
