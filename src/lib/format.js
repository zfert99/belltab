/**
 * Every string the user reads that is derived from a number.
 *
 * Imports nothing, deliberately. The 12/24-hour preference arrives as a
 * parameter rather than being read from a module global - a formatter that
 * consults hidden state is a formatter you cannot test.
 */

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
export function formatClock(totalMinutes, { hour12 = true } = {}) {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = String(totalMinutes % 60).padStart(2, "0");

  if (!hour12) return `${String(hours24).padStart(2, "0")}:${minutes}`;

  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes}`;
}

/** A period's length, for the list: 55 -> "55m", 90 -> "1h 30m". */
export function formatDuration(totalMinutes) {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/**
 * Splits a duration into the two numbers the display shows.
 *
 * Under an hour that is minutes and seconds ("43:12"). Over an hour it
 * becomes hours and minutes ("3:38"), because "218:12" is unreadable.
 *
 * KNOWN GAP: the two modes look identical, so "3:38" is ambiguous on its own.
 * It needs a unit label next to it - revisit when the markup gains a slot.
 */
export function splitCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));

  if (safeSeconds >= 3600) {
    return {
      major: String(Math.floor(safeSeconds / 3600)),
      minor: String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, "0"),
    };
  }

  return {
    major: String(Math.floor(safeSeconds / 60)),
    minor: String(safeSeconds % 60).padStart(2, "0"),
  };
}

/** The line under the strip: "3 of 7 - 3:38 until dismissal". */
export function formatDayCaption(day, position) {
  if (day.phase === "empty") return "No schedule";
  if (day.phase === "after") return `${position.total} of ${position.total} · done for today`;

  const { major, minor } = splitCountdown(day.remainingSec);
  const target = day.phase === "before" ? "until first bell" : "until dismissal";
  return `${position.index} of ${position.total} · ${major}:${minor} ${target}`;
}

/** One period, spelled out: "Period 3 - 10:10 to 11:05". */
export function formatPeriodLabel(period, options) {
  return `${period.name} · ${formatClock(period.startMin, options)}–${formatClock(period.endMin, options)}`;
}

/** The tab title: number first, so it survives truncation to a few characters. */
export function formatTabTitle(state) {
  if (state.phase === "after") return "Done - BellTab";
  if (state.phase === "empty") return "BellTab";

  const label = state.phase === "during" ? state.current.name : state.next.name;
  const minutes = Math.ceil(state.remainingSec / 60);
  return `${minutes}m - ${label}`;
}
