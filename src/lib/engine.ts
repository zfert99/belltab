import { PERIOD_KINDS, type Period, type ValidSchedule } from "./schedule";

/**
 * The schedule engine: what is true at a given moment.
 *
 * Pure. No DOM, no Date, no side effects - "what time is it" is always an
 * ARGUMENT. That is what makes every function here testable without faking a
 * clock: call stateAt with second 32700 and assert on what comes back.
 *
 * Every entry point takes a `ValidSchedule`, so none of them re-checks
 * ordering or overlap. If a schedule reached this file, it was parsed.
 */

/** The five states a school day can be in, and the only five. */
export type DayPhase = "empty" | "before" | "during" | "gap" | "after";

/**
 * Where the school day stands at a given moment.
 *
 * A discriminated union rather than one shape with nullable fields: during a
 * period there is always a `current`, before the first bell there is always a
 * `next`, and after dismissal there is neither. Spelling that out means the
 * tab-title formatter reads `state.current.name` without a null check and the
 * compiler agrees, instead of the check being a comment somewhere.
 */
export type DayState =
  | { phase: "empty"; current: null; next: null; remainingSec: number; progress: number }
  | { phase: "before"; current: null; next: Period; remainingSec: number; progress: number }
  | {
      phase: "during";
      current: Period;
      next: Period | null;
      remainingSec: number;
      progress: number;
    }
  | { phase: "gap"; current: null; next: Period; remainingSec: number; progress: number }
  | { phase: "after"; current: null; next: null; remainingSec: number; progress: number };

/** The whole day as one bar. No `current`/`next` - it is not asking that question. */
export interface DaySummary {
  phase: "empty" | "before" | "during" | "after";
  remainingSec: number;
  progress: number;
}

export type PeriodStatus = "past" | "current" | "future";

/** "3 of 7" - which countable block of the day this is. */
export interface BlockPosition {
  index: number;
  total: number;
}

/**
 * Where the school day stands at a given moment.
 *
 * @param schedule - a parsed schedule; periods are sorted and non-overlapping
 * @param nowSec - seconds since local midnight
 */
export function stateAt(schedule: ValidSchedule, nowSec: number): DayState {
  const periods = schedule.periods;

  if (periods.length === 0) {
    return { phase: "empty", current: null, next: null, remainingSec: 0, progress: 0 };
  }

  // Schedules store minutes; the countdown needs seconds. One multiply at the
  // boundary keeps the stored format integer-clean.
  const dayStartSec = periods[0].startMin * 60;
  const dayEndSec = periods[periods.length - 1].endMin * 60;

  if (nowSec < dayStartSec) {
    return {
      phase: "before",
      current: null,
      next: periods[0],
      remainingSec: dayStartSec - nowSec,
      progress: 0,
    };
  }

  if (nowSec >= dayEndSec) {
    return { phase: "after", current: null, next: null, remainingSec: 0, progress: 1 };
  }

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const startSec = period.startMin * 60;
    const endSec = period.endMin * 60;

    // A period is half-open: [start, end). At exactly its end second you are
    // already out of it. Without this, back-to-back periods would both claim
    // the same instant and the display would flicker between them.
    if (nowSec >= startSec && nowSec < endSec) {
      return {
        phase: "during",
        current: period,
        next: periods[i + 1] ?? null,
        remainingSec: endSec - nowSec,
        progress: (nowSec - startSec) / (endSec - startSec),
      };
    }

    // Past the day start, before this period, and not inside any earlier one:
    // we are in a gap. Gaps are legal - a schedule need not tile the day.
    if (nowSec < startSec) {
      const gapStartSec = periods[i - 1].endMin * 60;
      return {
        phase: "gap",
        current: null,
        next: period,
        remainingSec: startSec - nowSec,
        progress: (nowSec - gapStartSec) / (startSec - gapStartSec),
      };
    }
  }

  // Unreachable: the dayEndSec check above already caught everything past the
  // last period. Returned rather than thrown so a clock never dies mid-day.
  return { phase: "after", current: null, next: null, remainingSec: 0, progress: 1 };
}


/**
 * The whole day as one bar: first bell to last bell, gaps included.
 *
 * Kept separate from stateAt rather than bolted onto its return value, because
 * the two answer different questions and the Day view needs this without
 * caring which period is running. Deleted on 2026-09-03 with the retired Day
 * view's residue; restored on 2026-09-04 when the view was rebuilt.
 */
export function daySummaryAt(schedule: ValidSchedule, nowSec: number): DaySummary {
  const periods = schedule.periods;

  if (periods.length === 0) return { phase: "empty", remainingSec: 0, progress: 0 };

  const dayStartSec = periods[0].startMin * 60;
  const dayEndSec = periods[periods.length - 1].endMin * 60;

  if (nowSec < dayStartSec) {
    return { phase: "before", remainingSec: dayStartSec - nowSec, progress: 0 };
  }
  if (nowSec >= dayEndSec) {
    return { phase: "after", remainingSec: 0, progress: 1 };
  }
  return {
    phase: "during",
    remainingSec: dayEndSec - nowSec,
    progress: (nowSec - dayStartSec) / (dayEndSec - dayStartSec),
  };
}

/**
 * One period's status. Uses the same half-open rule as stateAt, so a period
 * cannot read as "current" in the list while the countdown has moved on.
 */
export function periodStatusAt(period: Period, nowSec: number): PeriodStatus {
  if (nowSec >= period.endMin * 60) return "past";
  if (nowSec < period.startMin * 60) return "future";
  return "current";
}

/**
 * "3 of 7" - which countable block of the day this is.
 *
 * Passing periods are excluded because they are the seams, not the units. A
 * student counting down their day counts classes and lunch, not the ninety
 * seconds of hallway between them. This is the one thing the engine asks of a
 * period's `kind`, and the reason "Passing" has a canonical spelling.
 *
 * Counts blocks that have STARTED, so mid-passing the number holds at the
 * block just finished rather than jumping ahead to one that has not begun.
 */
export function blockPositionAt(schedule: ValidSchedule, nowSec: number): BlockPosition {
  const blocks = schedule.periods.filter((p) => p.kind !== PERIOD_KINDS.PASSING);
  const started = blocks.filter((p) => nowSec >= p.startMin * 60).length;
  return { index: started, total: blocks.length };
}
