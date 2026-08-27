import type { IsoDate } from "./schedule";

/**
 * The one place a `Date` is turned into the integers the rest of the app
 * speaks.
 *
 * Pure, like everything else in `src/lib/`: `now` is an ARGUMENT, never
 * `new Date()` read from inside. The app has exactly one caller that reads the
 * real clock - the `useNow` hook - and everything downstream of this file
 * compares integers.
 *
 * Every field below is read with a LOCAL getter (`getHours`, not
 * `getUTCHours`). That is the whole reason BellTab needs no timezone plumbing:
 * a bell schedule is wall-clock, so "what does this device think the wall
 * clock says" is exactly the right question, and it is the one the platform
 * already answers correctly across DST.
 */

/** Everything the app needs to know about "now", as plain integers. */
export interface LocalNow {
  /** Seconds since local midnight, 0 to 86399. */
  secOfDay: number;
  /** The local calendar date, "YYYY-MM-DD". */
  isoDate: IsoDate;
  /** 0 = Sunday through 6 = Saturday, matching `Calendar.weekdays`. */
  weekday: number;
}

/**
 * Seconds since local midnight.
 *
 * Computed from the wall-clock fields rather than from epoch arithmetic. On a
 * DST transition day the local day is 23 or 25 hours long, so
 * `(epochMs - startOfDayMs) / 1000` disagrees with the clock on the wall by an
 * hour for part of the day - and the clock on the wall is what the bells run
 * on.
 *
 * Milliseconds are floored away rather than rounded: rounding would let the
 * displayed second reach a period's end boundary up to half a second before the
 * bell, which is the wrong direction to be wrong in.
 */
export function secondsSinceMidnight(now: Date): number {
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

/**
 * The local calendar date as "YYYY-MM-DD".
 *
 * Hand-formatted rather than `toISOString().slice(0, 10)`, which converts to
 * UTC first and therefore names the wrong day for every local evening east of
 * Greenwich and every local morning west of it. The calendar's overrides are
 * dates on a wall calendar; a snow day is not a UTC instant.
 */
export function localIsoDate(now: Date): IsoDate {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The complete reading, taken once so the three fields cannot disagree.
 *
 * Calling the three helpers separately would read the clock three times, and a
 * tick landing across midnight between two of them would produce a date from
 * one day and a second-of-day from the next.
 */
export function localNow(now: Date): LocalNow {
  return {
    secOfDay: secondsSinceMidnight(now),
    isoDate: localIsoDate(now),
    weekday: now.getDay(),
  };
}
