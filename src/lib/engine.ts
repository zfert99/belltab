import type { Period, ValidSchedule } from "./schedule";

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

export type PeriodStatus = "past" | "current" | "future";

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
 * One period's status. Uses the same half-open rule as stateAt, so a period
 * cannot read as "current" in the list while the countdown has moved on.
 */
export function periodStatusAt(period: Period, nowSec: number): PeriodStatus {
  if (nowSec >= period.endMin * 60) return "past";
  if (nowSec < period.startMin * 60) return "future";
  return "current";
}

