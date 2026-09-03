import { parseSchedule, type ParseResult } from "@/lib/parse";
import { PERIOD_KINDS, type PeriodKind, type ScheduleId, type Schedule, type ValidSchedule } from "@/lib/schedule";

/**
 * What the editor holds while it is being typed into.
 *
 * A draft is NOT a schedule. Its times are strings, because that is what an
 * `<input>` gives you and because a half-typed "9:" has to be representable -
 * an editor that cannot hold an invalid value cannot be typed into. The draft
 * is converted and handed to `parseSchedule` on every keystroke, and only the
 * results that come back `ok` are ever committed.
 *
 * That is the whole safety argument for Phase 3's gate. There is no code path
 * from a draft to storage that does not go through the parser, so "no input
 * sequence can produce an invalid schedule" is a property of the types rather
 * than of the UI's diligence.
 *
 * Everything here is pure. The functions take a draft and return a new one;
 * none of them reads a clock, a DOM or a store.
 */

export interface DraftPeriod {
  /**
   * A stable row identity, so React keys survive a reorder and a delete.
   *
   * Explicitly NOT the array index: deleting row 2 would renumber every row
   * below it and React would reuse the wrong input, carrying a half-typed
   * value onto a different period. Not `crypto.randomUUID()` either - that
   * would make every function in this file impure. The counter lives in the
   * draft.
   */
  rowId: string;
  name: string;
  kind: PeriodKind;
  /** "HH:MM", exactly as `<input type="time">` reports it. */
  start: string;
  /**
   * "HH:MM", the same shape as `start`. A VIEW of `start + length` that the
   * user can also type into: `updatePeriod` keeps the three in step, and
   * `draftToInput` reads only `start` and `length`. See the note there.
   */
  end: string;
  /** Minutes, as typed. A string, because `<input type="number">` can be empty. */
  length: string;
}

export interface Draft {
  id: ScheduleId | null;
  name: string;
  periods: readonly DraftPeriod[];
  nextRowId: number;
}

/** A default a new row can be typed over: 45 minutes, the shape of a class. */
const NEW_PERIOD_MINUTES = 45;

/** "09:05" to 545. Null for anything that is not a wall-clock time. */
export function clockToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match === null) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/**
 * 545 to "09:05".
 *
 * Always zero-padded to two digits, because this feeds `<input type="time">`,
 * whose value attribute is a fixed-format string rather than a display label.
 * "9:05" is silently rejected by the control and shows as blank.
 */
export function minutesToClock(totalMinutes: number): string {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * `start + length` as "HH:MM", or "" when either half is not a number yet.
 *
 * Blank rather than a guess: an end box showing yesterday's value beside a
 * half-typed start would be a number the user did not enter and might commit.
 */
export function endOf(start: string, length: string): string {
  const startMin = clockToMinutes(start);
  const minutes = length.trim() === "" ? null : Number(length);
  if (startMin === null || minutes === null || !Number.isFinite(minutes)) return "";

  const endMin = startMin + minutes;
  return endMin < 0 || endMin > 24 * 60 ? "" : minutesToClock(endMin);
}

/**
 * A stored schedule to something typeable.
 *
 * Length AND end time, since 2026-09-03 - and `length` is still the one the
 * draft believes. "Period 2 is 55 minutes" is how a schedule is described, it
 * keeps `start >= end` unreachable by typing a duration, and it is what lets a
 * moved period keep its length (`movePeriod` trades slots by length). The end
 * box exists because the other way round is how a schedule is READ off a wall
 * - "until 10:05" - and doing the subtraction in your head is exactly the kind
 * of arithmetic a clock app should be doing for you. The two fill each other in
 * via `updatePeriod`; the engine still stores `startMin`/`endMin`.
 */
export function toDraft(schedule: Schedule): Draft {
  return {
    id: schedule.id,
    name: schedule.name,
    nextRowId: schedule.periods.length,
    periods: schedule.periods.map((period, index) => ({
      rowId: String(index),
      name: period.name,
      kind: period.kind,
      start: minutesToClock(period.startMin),
      end: minutesToClock(period.endMin),
      length: String(period.endMin - period.startMin),
    })),
  };
}

/**
 * The draft as the parser wants to see it: `unknown`, deliberately.
 *
 * Nothing here checks anything. A blank time becomes `null`, a blank length
 * becomes `null`, and `parseSchedule` is what refuses them - with an `index`
 * and a `field` the editor can bind a message to. Validating here as well
 * would be the second half of "parse, don't validate" done twice, and the two
 * copies would drift.
 */
export function draftToInput(draft: Draft): unknown {
  return {
    id: draft.id,
    name: draft.name,
    periods: draft.periods.map((row) => {
      const startMin = clockToMinutes(row.start);
      const length = row.length.trim() === "" ? null : Number(row.length);

      return {
        name: row.name,
        kind: row.kind,
        startMin,
        endMin: startMin === null || length === null || !Number.isFinite(length) ? null : startMin + length,
      };
    }),
  };
}

/** The draft, run through the one function that can mint a `ValidSchedule`. */
export function parseDraft(draft: Draft): ParseResult<ValidSchedule> {
  return parseSchedule(draftToInput(draft));
}

/**
 * A new row, appended, starting where the day currently ends.
 *
 * Appending at the end and starting at the last period's end is the only
 * placement that is guaranteed not to collide with anything, so "Add period"
 * can never be the click that breaks the schedule. An empty draft starts at
 * 08:00 rather than midnight, because a schedule beginning at 00:00 is a
 * placeholder nobody meant.
 */
export function addPeriod(draft: Draft): Draft {
  const ends = draft.periods
    .map((row) => {
      const start = clockToMinutes(row.start);
      const length = Number(row.length);
      return start === null || !Number.isFinite(length) ? null : start + length;
    })
    .filter((end): end is number => end !== null);

  const startMin = ends.length > 0 ? Math.max(...ends) : 8 * 60;

  return {
    ...draft,
    nextRowId: draft.nextRowId + 1,
    periods: [
      ...draft.periods,
      {
        rowId: String(draft.nextRowId),
        name: "",
        kind: PERIOD_KINDS.CLASS,
        // Past the end of the day the row is unplaceable, so it is left blank
        // rather than wrapped round to the small hours.
        start: startMin + NEW_PERIOD_MINUTES > 24 * 60 ? "" : minutesToClock(startMin),
        end:
          startMin + NEW_PERIOD_MINUTES > 24 * 60
            ? ""
            : minutesToClock(startMin + NEW_PERIOD_MINUTES),
        length: String(NEW_PERIOD_MINUTES),
      },
    ],
  };
}

/**
 * Applies a patch, and keeps start, end and length in step.
 *
 * Three boxes, two degrees of freedom. Which one gives way depends on which
 * one was just typed into, and the rule is "the box you did not touch that is
 * furthest from what you meant":
 *
 * - Typing a LENGTH moves the end. (You said how long it is.)
 * - Typing an END moves the length. (You said when it finishes.)
 * - Typing a START moves the end and keeps the length. A period dragged to a
 *   new slot is the same period, and `movePeriod` depends on this too.
 *
 * A half-typed end - "10:" or one before the start - is kept as typed and the
 * length is left alone, so the parser gets the old length, complains about
 * nothing or about the right thing, and the user's keystrokes stay on screen.
 * An end before the start is the one case a length box could never express;
 * it reaches the parser as a negative length and comes back as "has to end
 * after it starts", bound to both boxes.
 */
export function updatePeriod(draft: Draft, rowId: string, patch: Partial<DraftPeriod>): Draft {
  return {
    ...draft,
    periods: draft.periods.map((row) => {
      if (row.rowId !== rowId) return row;

      const next = { ...row, ...patch };

      if ("end" in patch && !("length" in patch)) {
        const startMin = clockToMinutes(next.start);
        const endMin = clockToMinutes(next.end);
        if (startMin !== null && endMin !== null) next.length = String(endMin - startMin);
        return next;
      }

      if ("start" in patch || "length" in patch) next.end = endOf(next.start, next.length);

      return next;
    }),
  };
}

export function deletePeriod(draft: Draft, rowId: string): Draft {
  return { ...draft, periods: draft.periods.filter((row) => row.rowId !== rowId) };
}

/**
 * Swaps a period with its neighbour, and moves the clock with it.
 *
 * This is what "reorder" has to mean when periods are stored sorted by start
 * time: dragging a row up a list would be undone by the next parse, so the
 * move has to change the TIMES. The pair keeps its own lengths and trades
 * slots - the earlier of the two starts where the earlier one did, and the
 * other follows immediately after it.
 *
 * The result can never overlap. The pair's new span ends at
 * `firstStart + lengthA + lengthB`, which is at most where the later period
 * already ended, so nothing after it moves and nothing before it is touched.
 * Any gap that sat between the two ends up after the pair.
 *
 * Returns the draft UNCHANGED when either row's times are half-typed. A move
 * that cannot be computed is a no-op rather than a guess.
 */
export function movePeriod(draft: Draft, rowId: string, direction: -1 | 1): Draft {
  const index = draft.periods.findIndex((row) => row.rowId === rowId);
  if (index === -1) return draft;

  const target = index + direction;
  if (target < 0 || target >= draft.periods.length) return draft;

  const first = draft.periods[Math.min(index, target)];
  const second = draft.periods[Math.max(index, target)];

  const firstStart = clockToMinutes(first.start);
  const firstLength = Number(first.length);
  const secondLength = Number(second.length);
  if (firstStart === null || !Number.isFinite(firstLength) || !Number.isFinite(secondLength)) {
    return draft;
  }

  const swapped = [...draft.periods];
  const secondStart = minutesToClock(firstStart);
  const firstNewStart = minutesToClock(firstStart + secondLength);
  swapped[Math.min(index, target)] = {
    ...second,
    start: secondStart,
    end: endOf(secondStart, second.length),
  };
  swapped[Math.max(index, target)] = {
    ...first,
    start: firstNewStart,
    end: endOf(firstNewStart, first.length),
  };

  return { ...draft, periods: swapped };
}
