import type { BlockPosition, DayState, DaySummary } from "./engine";
import type { MinuteOfDay, Period } from "./schedule";

/**
 * Every string the user reads that is derived from a number.
 *
 * Imports no VALUES, deliberately - the type imports above erase at compile
 * time, so nothing here can run another module's code. The 12/24-hour
 * preference arrives as a parameter rather than being read from a module
 * global: a formatter that consults hidden state is a formatter you cannot
 * test.
 */

export interface ClockOptions {
  hour12?: boolean;
}

/**
 * Minutes since midnight to a wall-clock label: 545 -> "9:05" or "09:05".
 *
 * The 12/24 choice is a PARAMETER, not a module-level setting read from
 * inside. A preference consulted internally would make this function's output
 * depend on hidden state, which is exactly what makes a formatter untestable.
 *
 * 24-hour pads the hour ("09:05"), 12-hour does not ("9:05") - that is the
 * convention in each, not an inconsistency.
 */
export function formatClock(totalMinutes: MinuteOfDay, { hour12 = true }: ClockOptions = {}): string {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = String(totalMinutes % 60).padStart(2, "0");

  if (!hour12) return `${String(hours24).padStart(2, "0")}:${minutes}`;

  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes}`;
}

/** A period's length, for the list: 55 -> "55m", 90 -> "1h 30m". */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/**
 * The two scales a countdown can be on, spelled the way the UI captions them.
 *
 * Exported so nothing has to compare against the literal string: splitCountdown
 * decides the scale, and every caller that needs to know which one it got reads
 * the answer from here.
 */
export const COUNTDOWN_UNITS = {
  hoursMinutes: "hr : min",
  minutesSeconds: "min : sec",
} as const;

export type CountdownUnit = (typeof COUNTDOWN_UNITS)[keyof typeof COUNTDOWN_UNITS];

export interface CountdownParts {
  major: string;
  minor: string;
  unit: CountdownUnit;
}

/**
 * Splits a duration into the two numbers the display shows, and says what they
 * mean.
 *
 * Under an hour that is minutes and seconds ("43:12"). Over an hour it becomes
 * hours and minutes ("3:38"), because "218:12" is unreadable.
 *
 * The `unit` is not decoration. The two modes render identically, so "3:38"
 * alone could be three hours or three minutes - a countdown that is ambiguous
 * about its own units is worse than one that is merely ugly. Callers that show
 * the number in a context where the scale is already obvious (a period row
 * that says "55m" beside it) are free to ignore it.
 */
export function splitCountdown(totalSeconds: number): CountdownParts {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));

  if (safeSeconds >= 3600) {
    return {
      major: String(Math.floor(safeSeconds / 3600)),
      minor: String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, "0"),
      unit: COUNTDOWN_UNITS.hoursMinutes,
    };
  }

  return {
    major: String(Math.floor(safeSeconds / 60)),
    minor: String(safeSeconds % 60).padStart(2, "0"),
    unit: COUNTDOWN_UNITS.minutesSeconds,
  };
}


/**
 * The Day view's one-line summary: "3 of 7 · 3h 38m until dismissal".
 *
 * Built from formatRemaining, not from splitCountdown's bare numbers, because
 * this caption has nothing beside it to say which scale it is on - a bare
 * "1:00" is one minute and one hour at once. Restored on 2026-09-04 with the
 * rebuilt Day view; see Docs/build-log.md.
 */
export function formatDayCaption(day: DaySummary, position: BlockPosition): string {
  if (day.phase === "empty") return "No schedule";
  if (day.phase === "after") return `${position.total} of ${position.total} · done for today`;

  const target = day.phase === "before" ? "until first bell" : "until dismissal";
  return `${position.index} of ${position.total} · ${formatRemaining(day.remainingSec)} ${target}`;
}

/** One period, spelled out: "Period 3 - 10:10 to 11:05". */
export function formatPeriodLabel(period: Period, options?: ClockOptions): string {
  return `${period.name} · ${formatClock(period.startMin, options)}–${formatClock(period.endMin, options)}`;
}

/**
 * The tab title: number first, so it survives truncation to a few characters.
 *
 * The separator is U+00B7 MIDDLE DOT, not a hyphen. That is what the design
 * system, the plan, the roadmap and the README all specify - a hyphen reads as
 * a range or a minus sign next to a number, which is the one thing this string
 * is mostly made of.
 *
 * The `during`/otherwise branch below needs no null check: DayState's union
 * already guarantees a `current` during a period and a `next` before one.
 */
export function formatTabTitle(state: DayState): string {
  if (state.phase === "after") return "Done · BellTab";
  if (state.phase === "empty") return "BellTab";

  const label = state.phase === "during" ? state.current.name : state.next.name;
  const minutes = Math.ceil(state.remainingSec / 60);
  return `${minutes}m · ${label}`;
}

/**
 * A live countdown in the same vocabulary the period list already uses for
 * fixed lengths: "49m 06s", "1h 05m".
 *
 * The Day view shows this number directly beneath siblings formatted by
 * formatDuration ("10m", "1h"), where a bare "1:20" reads as one minute twenty
 * rather than one hour twenty. Spelling the units into the string is the only
 * form that survives being read next to those.
 *
 * The minor part keeps its zero padding even though formatDuration would not:
 * this one ticks, and an unpadded seconds place changes the string's width
 * every ten seconds.
 */
export function formatRemaining(totalSeconds: number): string {
  const { major, minor, unit } = splitCountdown(totalSeconds);

  return unit === COUNTDOWN_UNITS.hoursMinutes ? `${major}h ${minor}m` : `${major}m ${minor}s`;
}

/**
 * What a screen-reader user is told when a bell rings.
 *
 * The tab title announces nothing and the countdown must never be live
 * (`AGENTS.md`), so a `aria-live="polite"` region firing only at boundaries is
 * the only way the bell is conveyed at all. Empty string means "say nothing":
 * before the first bell nothing has happened yet, and an empty schedule has no
 * bells to ring.
 */
export function announcementFor(state: DayState): string {
  switch (state.phase) {
    case "during":
      return `${state.current.name} has started.`;
    case "gap":
      return `${state.next.name} is next.`;
    case "after":
      return "School is out.";
    default:
      return "";
  }
}

/**
 * A string that changes exactly when a bell rings, and at no other time.
 *
 * Keyed on the period's TIMES, never on its name. The retired build keyed the
 * announcer on the name and re-announced on every keystroke while the running
 * period was being renamed in the editor - four announcements for "Chem". See
 * the announcer spec and Bugs found in Docs/build-log.md.
 *
 * A gap is identified by the period it leads to, because that is what changes
 * when the gap ends.
 */
export function boundaryKey(state: DayState): string {
  switch (state.phase) {
    case "during":
      return `during:${state.current.startMin}-${state.current.endMin}`;
    case "gap":
      return `gap:${state.next.startMin}`;
    default:
      return state.phase;
  }
}
