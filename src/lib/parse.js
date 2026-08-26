import { PERIOD_KINDS } from "./schedule.js";

/**
 * The boundary. Untrusted input in, validated data or structured errors out.
 *
 * Everything the app reads from outside itself - localStorage, a share link, a
 * typed form - passes through here exactly once. Downstream code is unable to
 * hold an unvalidated schedule, so nothing past this file re-checks ordering
 * or overlap.
 *
 * Pure, like engine.js, and tested the same way.
 */

/**
 * Caps applied before anything is parsed.
 *
 * These exist because schedules will eventually arrive from a link someone was
 * sent. A hand-crafted payload claiming fifty thousand periods must be refused
 * at the boundary, not discovered halfway through building fifty thousand DOM
 * nodes.
 */
export const SCHEDULE_LIMITS = {
  schedules: 50,
  periods: 60,
  nameChars: 60,
  overrides: 400,
};

const KIND_VALUES = Object.values(PERIOD_KINDS);

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

function daysInMonth(year, month) {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
}

/** A minute-of-day, or null. Midnight-as-end (1440) is legal; as start it is not. */
function toMinuteOfDay(value) {
  return Number.isInteger(value) && value >= 0 && value <= 1440 ? value : null;
}

/**
 * "YYYY-MM-DD" or null.
 *
 * Checks the shape AND that the date exists - 2026-02-30 matches the pattern
 * and is not a day. Done arithmetically rather than by round-tripping through
 * Date, which silently rolls 2026-02-30 forward to March 2nd instead of
 * rejecting it.
 */
export function parseIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return value;
}

/**
 * Untrusted input in, a validated schedule or structured errors out.
 *
 * Returns `{ ok: true, value }` or `{ ok: false, errors }` - never a boolean.
 * The point is that code holding the `value` cannot be holding something
 * unvalidated, so nothing downstream re-checks ordering or overlap.
 *
 * Each error carries the index of the row it belongs to and the field within
 * it, so the editor can bind the message to that input with aria-describedby
 * rather than colouring a border red and leaving a screen reader with nothing.
 *
 * Periods come out SORTED. That is a normalisation, not a rejection - the
 * order a user typed rows in is not the order the day runs in.
 */
export function parseSchedule(input) {
  const errors = [];
  const fail = (index, field, message) => errors.push({ index, field, message });

  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: [{ index: null, field: "schedule", message: "That is not a schedule." }] };
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) fail(null, "name", "Give the schedule a name.");
  else if (name.length > SCHEDULE_LIMITS.nameChars) {
    fail(null, "name", `Keep the name under ${SCHEDULE_LIMITS.nameChars} characters.`);
  }

  if (!Array.isArray(input.periods)) {
    fail(null, "periods", "This schedule has no periods.");
    return { ok: false, errors };
  }
  if (input.periods.length > SCHEDULE_LIMITS.periods) {
    fail(null, "periods", `A schedule cannot have more than ${SCHEDULE_LIMITS.periods} periods.`);
    return { ok: false, errors };
  }

  const parsed = [];

  input.periods.forEach((raw, index) => {
    if (typeof raw !== "object" || raw === null) {
      fail(index, "period", "That is not a period.");
      return;
    }

    const periodName = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!periodName) fail(index, "name", "Give the period a name.");
    else if (periodName.length > SCHEDULE_LIMITS.nameChars) {
      fail(index, "name", `Keep the name under ${SCHEDULE_LIMITS.nameChars} characters.`);
    }

    const kind = KIND_VALUES.includes(raw.kind) ? raw.kind : null;
    if (!kind) fail(index, "kind", "Pick what this period is.");

    const startMin = toMinuteOfDay(raw.startMin);
    const endMin = toMinuteOfDay(raw.endMin);
    if (startMin === null) fail(index, "startMin", "That is not a time of day.");
    if (endMin === null) fail(index, "endMin", "That is not a length.");
    if (startMin !== null && endMin !== null && startMin >= endMin) {
      fail(index, "endMin", "A period has to end after it starts.");
    }

    if (periodName && kind && startMin !== null && endMin !== null && startMin < endMin) {
      parsed.push({ index, name: periodName, kind, startMin, endMin });
    }
  });

  // Overlap is checked on a sorted copy so the message can name the period
  // actually collided with, rather than just "invalid". Each row keeps its
  // original index so the error lands on the row the user is looking at.
  const sorted = [...parsed].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (current.startMin < previous.endMin) {
      fail(
        current.index,
        "startMin",
        `${current.name} overlaps ${previous.name}. Two periods cannot run at the same time.`,
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      id: typeof input.id === "string" && input.id ? input.id : null,
      name,
      periods: sorted.map(({ name, kind, startMin, endMin }) => ({ name, kind, startMin, endMin })),
    },
  };
}

/**
 * The calendar, validated against the schedules that actually exist.
 *
 * A weekday or override pointing at a deleted schedule is not an error worth
 * refusing the whole calendar over - it degrades to "no school", which is
 * already a state the app renders properly.
 */
export function parseCalendar(input, knownIds) {
  const known = new Set(knownIds);
  const source = typeof input === "object" && input !== null ? input : {};

  const rawWeekdays = Array.isArray(source.weekdays) ? source.weekdays : [];
  const weekdays = Array.from({ length: 7 }, (_, day) => {
    const id = rawWeekdays[day];
    return known.has(id) ? id : null;
  });

  const rawOverrides = Array.isArray(source.overrides) ? source.overrides : [];
  const seen = new Set();
  const overrides = [];

  for (const entry of rawOverrides.slice(0, SCHEDULE_LIMITS.overrides)) {
    if (typeof entry !== "object" || entry === null) continue;

    const date = parseIsoDate(entry.date);
    if (!date || seen.has(date)) continue;
    seen.add(date);

    // null is meaningful here and NOT the same as a missing entry: it is an
    // explicit closure - a snow day - which has to beat the weekday map.
    overrides.push({ date, scheduleId: known.has(entry.scheduleId) ? entry.scheduleId : null });
  }

  overrides.sort((a, b) => a.date.localeCompare(b.date));
  return { weekdays, overrides };
}

/**
 * Which schedule applies, in priority order: an explicit date override first,
 * then the weekday default, then nothing.
 *
 * `weekday` is passed IN rather than derived from the date string, so this
 * stays pure - the caller reads the clock, this function only compares.
 * Returns a schedule id, or null for no school.
 */
export function resolveScheduleId(calendar, isoDate, weekday) {
  const override = calendar.overrides.find((entry) => entry.date === isoDate);

  // Deliberately checks for the entry, not its value: an override to null is a
  // closure that must win over a weekday that says school is on.
  if (override) return override.scheduleId;

  return calendar.weekdays[weekday] ?? null;
}
