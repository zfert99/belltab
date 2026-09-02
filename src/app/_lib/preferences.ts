import { THEMES, isTheme, type Theme } from "@/app/_lib/theme";

/**
 * The device's own settings, as opposed to the user's schedules.
 *
 * The split is `AGENTS.md`'s: `localStorage` holds convenience, and it names
 * "last-used schedule, theme, bell offset, wake-lock toggle" as the examples.
 * The first of those lives in the library; the rest live here, in their own key,
 * for one reason that decides the whole design:
 *
 * **Preferences must not travel.** A bell offset is a measurement of ONE
 * building's clock against ONE device's clock. Folding it into the library
 * would put it in the JSON backup and, worse, in a share link - so a teacher who
 * measured their bells at twelve seconds fast would hand that skew to everyone
 * they sent a schedule to, silently, as part of what looks like a timetable.
 * Same for the theme: it is a choice about a screen, not about a school day.
 *
 * Everything in this file is pure; the `localStorage` calls live in
 * `preferencesStore.ts`, exactly as `library.ts` and `libraryStore.ts` divide.
 */

/**
 * Versioned in the key, for the same reason the library's is.
 *
 * A v2 reader looks for its own key, misses, and starts clean rather than having
 * to parse v1's bytes to discover it cannot read them. Never repurpose a number.
 *
 * **Duplicated, deliberately, in `THEME_SCRIPT`.** That script runs before any
 * module loads and therefore cannot import this constant. The two are pinned
 * together by `preferences.test.ts`, which asserts the script's source contains
 * this exact key - so a rename that misses one fails the suite instead of
 * silently reverting everyone's theme to the OS default on next paint.
 */
export const PREFERENCES_KEY = "belltab.prefs.v1";

/**
 * How far the bell offset may be nudged, in seconds either way.
 *
 * Five minutes. The offset exists to cancel the drift between a school's bell
 * controller and a phone that syncs with NTP, which is seconds to a minute in
 * practice; a cap that comfortably clears the real range keeps this a
 * correction rather than a second, hidden way to edit a schedule. Anything
 * bigger is a period that starts at a different time, and the editor is where
 * that is said out loud.
 */
export const BELL_OFFSET_LIMIT_SEC = 300;

export interface Preferences {
  /** Which palette to paint, or `"system"` to follow the OS. */
  theme: Theme;
  /**
   * Seconds ADDED to the device clock before the engine is asked what is true.
   *
   * Positive runs the countdown ahead of the device, which is what a user wants
   * when the real bell rings before BellTab reaches zero. Negative runs it
   * behind. Zero, the default, means the device clock is taken at its word.
   */
  bellOffsetSec: number;
  /**
   * Whether to hold a screen wake lock while the countdown is on screen.
   *
   * Off by default, and that is a decision rather than an oversight. A wake lock
   * stops a laptop dimming and stops a phone locking, which is exactly right for
   * a projector and exactly wrong for a tab somebody left open on a train. The
   * research (`background-timers-and-schedule-modeling.md`) asks for "an
   * explicit toggle" for the same reason, so the default has to be the state
   * nobody is surprised by.
   */
  keepScreenAwake: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  bellOffsetSec: 0,
  keepScreenAwake: false,
};

export { THEMES };
export type { Theme };

/**
 * A stored string to preferences, degrading FIELD BY FIELD.
 *
 * This is the one place the preferences boundary deliberately behaves unlike
 * `loadLibrary`, which is all-or-nothing. A library is one interlocking thing -
 * a calendar pointing at schedules - so half of one is not a smaller library,
 * it is a broken one. Preferences are independent scalars: a theme that no
 * longer exists says nothing at all about whether the bell offset is still a
 * usable number, and throwing away a measured offset because a theme was
 * renamed would be a worse answer than either field can justify.
 *
 * Every failure path lands on a default, and none of them throws. `AGENTS.md`:
 * a corrupt or absent value must degrade to a clean state, never a crash.
 */
export function loadPreferences(raw: string | null): Preferences {
  if (raw === null) return DEFAULT_PREFERENCES;

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return DEFAULT_PREFERENCES;
  }

  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    return DEFAULT_PREFERENCES;
  }

  const source = decoded as {
    theme?: unknown;
    bellOffsetSec?: unknown;
    keepScreenAwake?: unknown;
  };

  return {
    theme: isTheme(source.theme) ? source.theme : DEFAULT_PREFERENCES.theme,
    bellOffsetSec: parseBellOffset(source.bellOffsetSec) ?? DEFAULT_PREFERENCES.bellOffsetSec,
    // A boolean needs no parser of its own - there is no half-typed draft of a
    // checkbox for a caller to want reported differently, which is the whole
    // reason `parseBellOffset` exists as a separate export.
    keepScreenAwake:
      typeof source.keepScreenAwake === "boolean"
        ? source.keepScreenAwake
        : DEFAULT_PREFERENCES.keepScreenAwake,
  };
}

/**
 * An untrusted value to a usable offset, or `null`.
 *
 * `null` rather than a clamped number, because the two callers want different
 * things from a bad value and only one of them can say so. Storage substitutes
 * the default silently; the panel's number field leaves what the user typed on
 * screen and does not commit it, so a half-typed `-` is not read as zero and
 * written back over the value they were editing.
 *
 * Rejects rather than rounds a fractional offset: the clock is read to the
 * second and a half-second correction is a number that cannot do anything.
 */
export function parseBellOffset(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (Math.abs(value) > BELL_OFFSET_LIMIT_SEC) return null;

  // -0 is an integer, is within the cap, and serialises to `0` - but it survives
  // `Object.is` comparisons as a distinct value, which is a trap nobody needs in
  // a preference. Normalised here rather than at three call sites.
  return value === 0 ? 0 : value;
}

/** Preferences to the string that goes in `localStorage`. Plain, readable JSON. */
export function serializePreferences(preferences: Preferences): string {
  return JSON.stringify({
    theme: preferences.theme,
    bellOffsetSec: preferences.bellOffsetSec,
    keepScreenAwake: preferences.keepScreenAwake,
  });
}
