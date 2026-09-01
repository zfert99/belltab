import {
  PERIOD_KINDS,
  type Calendar,
  type CalendarOverride,
  type IsoDate,
  type MinuteOfDay,
  type Period,
  type PeriodKind,
  type ScheduleId,
  type ValidSchedule,
  type WeekdayMap,
} from "./schedule";

/**
 * The boundary. Untrusted input in, validated data or structured errors out.
 *
 * Everything the app reads from outside itself - localStorage, a share link, a
 * typed form - passes through here exactly once. Downstream code is unable to
 * hold an unvalidated schedule, so nothing past this file re-checks ordering
 * or overlap.
 *
 * Pure, like engine.ts, and tested the same way.
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
} as const;

/**
 * One thing wrong with one field.
 *
 * `index` is the row it belongs to, or null for a schedule-level problem, and
 * `field` is the input within that row - together they are what lets the
 * editor bind the message to the offending control with `aria-describedby`
 * rather than colouring a border red and leaving a screen reader with nothing.
 */
export interface ParseError {
  index: number | null;
  field: string;
  message: string;
}

/**
 * The parser's answer: the parsed value or the reasons it was refused.
 *
 * A discriminated union rather than a boolean, so `result.value` is
 * unreachable until `result.ok` has been checked. That is the type-level half
 * of "parse, don't validate" - the other half is the brand on `ValidSchedule`.
 */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: ParseError[] };

const KIND_VALUES: readonly PeriodKind[] = Object.values(PERIOD_KINDS);

const isPeriodKind = (value: unknown): value is PeriodKind =>
  (KIND_VALUES as readonly unknown[]).includes(value);

/**
 * Narrows unknown input to something with readable properties.
 *
 * Every use of this is a boundary crossing and nothing else: the returned
 * record's values are still `unknown`, so the compiler keeps insisting each
 * one is checked before it is believed.
 */
const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
}

/** A minute-of-day, or null. Midnight-as-end (1440) is legal; as start it is not. */
function toMinuteOfDay(value: unknown): MinuteOfDay | null {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 1440
    ? (value as number)
    : null;
}

/**
 * "YYYY-MM-DD" or null.
 *
 * Checks the shape AND that the date exists - 2026-02-30 matches the pattern
 * and is not a day. Done arithmetically rather than by round-tripping through
 * Date, which silently rolls 2026-02-30 forward to March 2nd instead of
 * rejecting it.
 */
export function parseIsoDate(value: unknown): IsoDate | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return value;
}

/** A period that has passed field validation, still carrying the row it came from. */
interface IndexedPeriod extends Period {
  index: number;
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
export function parseSchedule(input: unknown): ParseResult<ValidSchedule> {
  const errors: ParseError[] = [];
  const fail = (index: number | null, field: string, message: string) =>
    errors.push({ index, field, message });

  const source = asRecord(input);
  if (source === null) {
    return {
      ok: false,
      errors: [{ index: null, field: "schedule", message: "That is not a schedule." }],
    };
  }

  const name = typeof source.name === "string" ? source.name.trim() : "";
  if (!name) fail(null, "name", "Give the schedule a name.");
  else if (name.length > SCHEDULE_LIMITS.nameChars) {
    fail(null, "name", `Keep the name under ${SCHEDULE_LIMITS.nameChars} characters.`);
  }

  if (!Array.isArray(source.periods)) {
    fail(null, "periods", "This schedule has no periods.");
    return { ok: false, errors };
  }
  if (source.periods.length > SCHEDULE_LIMITS.periods) {
    fail(null, "periods", `A schedule cannot have more than ${SCHEDULE_LIMITS.periods} periods.`);
    return { ok: false, errors };
  }

  const parsed: IndexedPeriod[] = [];

  (source.periods as unknown[]).forEach((raw, index) => {
    const row = asRecord(raw);
    if (row === null) {
      fail(index, "period", "That is not a period.");
      return;
    }

    const periodName = typeof row.name === "string" ? row.name.trim() : "";
    if (!periodName) fail(index, "name", "Give the period a name.");
    else if (periodName.length > SCHEDULE_LIMITS.nameChars) {
      fail(index, "name", `Keep the name under ${SCHEDULE_LIMITS.nameChars} characters.`);
    }

    const kind = isPeriodKind(row.kind) ? row.kind : null;
    if (!kind) fail(index, "kind", "Pick what this period is.");

    const startMin = toMinuteOfDay(row.startMin);
    const endMin = toMinuteOfDay(row.endMin);
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

  const value = {
    id: typeof source.id === "string" && source.id ? source.id : null,
    name,
    periods: sorted.map(({ name, kind, startMin, endMin }) => ({ name, kind, startMin, endMin })),
  };

  // The one place in the codebase that mints a ValidSchedule.
  //
  // The double assertion is not laziness: the brand is a `unique symbol`
  // property, so an unbranded object does not "sufficiently overlap" it and
  // TypeScript refuses the direct cast (TS2352). Going through `unknown` is the
  // only way to write this line, which is exactly the point - forging a
  // ValidSchedule anywhere else would have to be this conspicuous. This is the
  // only such assertion in `src/`, and a second one would read as a lie in a
  // diff rather than as a silently missing check.
  return { ok: true, value: value as unknown as ValidSchedule };
}

/**
 * A schedule the calendar is able to point at.
 *
 * `Schedule.id` is nullable, and for a single schedule that is right: one typed
 * into the editor or decoded from a share link need not have an identity yet.
 * A schedule in the LIBRARY must have one, because the calendar points at
 * schedules BY id - so a schedule without an id is a schedule no weekday and no
 * override can ever select. `parseScheduleCollection` is where that becomes
 * true rather than merely likely.
 */
export type IdentifiedSchedule = ValidSchedule & { readonly id: ScheduleId };

/**
 * A type predicate, deliberately, rather than a second cast.
 *
 * `parseSchedule`'s double assertion is the only one in `src/`, and the build
 * log says a second would read as a lie in a diff. This narrows without
 * asserting anything: TypeScript accepts `schedule is IdentifiedSchedule`
 * because the intersection is assignable to the parameter type, so
 * `filter(isIdentified)` produces the narrower array with nothing forged.
 */
export const isIdentified = (schedule: ValidSchedule): schedule is IdentifiedSchedule =>
  schedule.id !== null;

/**
 * The first `s1`, `s2`, ... that nothing already answers to.
 *
 * Opaque and sequential rather than derived from the name: a schedule's name is
 * user input and changes, and an id that changed with it would silently orphan
 * every weekday and override pointing at that schedule. Exported because
 * creating and duplicating a schedule needs the same guarantee the boundary
 * gives an imported one.
 */
export function unusedScheduleId(taken: Iterable<ScheduleId>): ScheduleId {
  const used = new Set(taken);
  let n = 1;
  while (used.has(`s${n}`)) n++;
  return `s${n}`;
}

/**
 * Every entry in a collection, carrying a unique non-empty id.
 *
 * Two passes, because the first claimant of a duplicated id has to keep it: one
 * pass would either renumber the wrong entry or hand a later one an id an
 * earlier one already answers to, and the calendar would then be pointing at
 * both at once.
 *
 * Entries that are not objects pass through untouched, so `parseSchedule`
 * refuses them against their own row index rather than this function swallowing
 * the error.
 */
function withUniqueIds(input: readonly unknown[]): unknown[] {
  const taken = new Set<ScheduleId>();

  const claimed = input.map((raw) => {
    const id = asRecord(raw)?.id;
    if (typeof id !== "string" || !id || taken.has(id)) return null;
    taken.add(id);
    return id;
  });

  return input.map((raw, index) => {
    const row = asRecord(raw);
    if (row === null) return raw;

    const id = claimed[index] ?? unusedScheduleId(taken);
    taken.add(id);
    return { ...row, id };
  });
}

/**
 * A list of schedules in, a list of identified, validated schedules or
 * structured errors out.
 *
 * This is the enforcer for `SCHEDULE_LIMITS.schedules`, which until now was the
 * one cap in that object with no code applying it: its only caller was the
 * collection loader in the retired `src/store.js`, and it was deleted with the
 * plain build, leaving a documented boundary that silently was not one. See
 * Docs/code-review-2026-08-27.md, finding 3.
 *
 * The cap REFUSES rather than truncates, matching `periods` above. Silently
 * dropping schedule 51 from a link someone was sent is a worse answer than
 * saying the link is too big - the user can see and fix the second one.
 *
 * Errors are one per bad entry, indexed by the entry's position in the list.
 * The per-field detail that the editor binds with `aria-describedby` belongs to
 * `parseSchedule`, which the editor calls on one schedule at a time; a
 * collection arrives from localStorage, a JSON import or a share link, where
 * there is no form control to point at.
 *
 * **Phase 4:** the returned schedules are IDENTIFIED - every one carries a
 * unique, non-empty id, assigned here to any entry that arrived without a usable
 * one. That is what lets the calendar point at every schedule in the library
 * rather than at only the ones whose author happened to supply an id.
 */
export function parseScheduleCollection(input: unknown): ParseResult<IdentifiedSchedule[]> {
  if (!Array.isArray(input)) {
    return {
      ok: false,
      errors: [{ index: null, field: "schedules", message: "That is not a list of schedules." }],
    };
  }

  if (input.length > SCHEDULE_LIMITS.schedules) {
    return {
      ok: false,
      errors: [
        {
          index: null,
          field: "schedules",
          message: `There cannot be more than ${SCHEDULE_LIMITS.schedules} schedules.`,
        },
      ],
    };
  }

  const errors: ParseError[] = [];
  const value: ValidSchedule[] = [];

  withUniqueIds(input as unknown[]).forEach((raw, index) => {
    const result = parseSchedule(raw);
    if (result.ok) {
      value.push(result.value);
      return;
    }
    errors.push({ index, field: "schedule", message: result.errors[0].message });
  });

  if (errors.length > 0) return { ok: false, errors };

  // Narrowing, not filtering. Every entry went through `withUniqueIds`, so
  // every schedule that parsed carries an id and nothing is dropped here - the
  // test that counts the survivors is what keeps that true.
  return { ok: true, value: value.filter(isIdentified) };
}

/**
 * The calendar, validated against the schedules that actually exist.
 *
 * A weekday or override pointing at a deleted schedule is not an error worth
 * refusing the whole calendar over - it degrades to "no school", which is
 * already a state the app renders properly. That is why this returns a
 * Calendar directly rather than a ParseResult: there is no input it can refuse.
 */
export function parseCalendar(input: unknown, knownIds: readonly ScheduleId[]): Calendar {
  const known = new Set(knownIds);
  const source = asRecord(input) ?? {};

  const rawWeekdays: unknown[] = Array.isArray(source.weekdays) ? source.weekdays : [];
  const weekdayAt = (day: number): ScheduleId | null => {
    const id = rawWeekdays[day];
    return typeof id === "string" && known.has(id) ? id : null;
  };

  // Spelled out rather than built with Array.from, so the seven-entry tuple is
  // something the compiler knows rather than something a cast asserts.
  const weekdays: WeekdayMap = [
    weekdayAt(0),
    weekdayAt(1),
    weekdayAt(2),
    weekdayAt(3),
    weekdayAt(4),
    weekdayAt(5),
    weekdayAt(6),
  ];

  const rawOverrides: unknown[] = Array.isArray(source.overrides) ? source.overrides : [];
  const seen = new Set<IsoDate>();
  const overrides: CalendarOverride[] = [];

  for (const raw of rawOverrides.slice(0, SCHEDULE_LIMITS.overrides)) {
    const entry = asRecord(raw);
    if (entry === null) continue;

    const date = parseIsoDate(entry.date);
    if (!date || seen.has(date)) continue;
    seen.add(date);

    // null is meaningful here and NOT the same as a missing entry: it is an
    // explicit closure - a snow day - which has to beat the weekday map.
    const scheduleId =
      typeof entry.scheduleId === "string" && known.has(entry.scheduleId)
        ? entry.scheduleId
        : null;
    overrides.push({ date, scheduleId });
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
export function resolveScheduleId(
  calendar: Calendar,
  isoDate: IsoDate,
  weekday: number,
): ScheduleId | null {
  const override = calendar.overrides.find((entry) => entry.date === isoDate);

  // Deliberately checks for the entry, not its value: an override to null is a
  // closure that must win over a weekday that says school is on.
  if (override) return override.scheduleId;

  return calendar.weekdays[weekday] ?? null;
}
